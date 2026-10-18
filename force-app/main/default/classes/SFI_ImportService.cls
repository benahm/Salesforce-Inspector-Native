/**
 * Mass insert / update / upsert / delete for Data Import.
 * DML runs in USER_MODE with allOrNone=false: each row succeeds or fails on its own,
 * within the running user's CRUD, FLS and sharing.
 */
public with sharing class SFI_ImportService {
  public static final Integer MAX_BATCH_SIZE = 2000;
  private static final Set<String> OPERATIONS = new Set<String>{
    'insert',
    'update',
    'upsert',
    'delete'
  };

  public class ImportField {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String type;
    @AuraEnabled
    public Boolean createable;
    @AuraEnabled
    public Boolean updateable;
    @AuraEnabled
    public Boolean externalId;
    @AuraEnabled
    public Boolean requiredOnCreate;
  }

  public class RowResult {
    @AuraEnabled
    public Integer index;
    @AuraEnabled
    public Boolean success;
    @AuraEnabled
    public String id;
    @AuraEnabled
    public Boolean created;
    @AuraEnabled
    public String error;

    RowResult(Integer index) {
      this.index = index;
      this.success = false;
    }
  }

  /**
   * Fields usable for an import, with the flags the mapping screen needs.
   */
  @AuraEnabled(cacheable=true)
  public static List<ImportField> getImportFields(String objectApiName) {
    try {
      List<ImportField> result = new List<ImportField>();
      for (
        Schema.SObjectField field : SFI_DescribeService.describe(objectApiName)
          .fields.getMap()
          .values()
      ) {
        Schema.DescribeFieldResult d = field.getDescribe();
        if (!d.isAccessible()) {
          continue;
        }
        ImportField info = new ImportField();
        info.name = d.getName();
        info.label = d.getLabel();
        info.type = d.getType().name();
        info.createable = d.isCreateable();
        info.updateable = d.isUpdateable();
        info.externalId = d.isExternalId() || d.isIdLookup();
        info.requiredOnCreate =
          d.isCreateable() &&
          !d.isNillable() &&
          !d.isDefaultedOnCreate() &&
          d.getType() != Schema.DisplayType.BOOLEAN;
        result.add(info);
      }
      return result;
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }

  /**
   * Imports one batch. rows is a list of { fieldApiName: textValue } in file order;
   * firstIndex is the position of the first row in the file, echoed in the results.
   * With validateOnly, the DML is rolled back: errors are real, nothing is saved.
   */
  @AuraEnabled
  public static List<RowResult> importBatch(
    String objectApiName,
    String operation,
    String externalIdField,
    List<Map<String, String>> rows,
    Boolean clearEmptyValues,
    Boolean validateOnly,
    Integer firstIndex
  ) {
    try {
      String op = operation == null ? '' : operation.toLowerCase();
      if (!OPERATIONS.contains(op)) {
        throw new SFI_Exception('Unsupported operation: ' + operation);
      }
      if (rows == null || rows.isEmpty()) {
        return new List<RowResult>();
      }
      if (rows.size() > MAX_BATCH_SIZE) {
        throw new SFI_Exception(
          'A batch cannot exceed ' + MAX_BATCH_SIZE + ' rows.'
        );
      }
      Schema.DescribeSObjectResult objectDescribe = SFI_DescribeService.describe(
        objectApiName
      );
      Integer offset = firstIndex == null ? 0 : firstIndex;

      Savepoint savepoint = validateOnly == true
        ? Database.setSavepoint()
        : null;
      List<RowResult> results;
      try {
        results = op == 'delete'
          ? deleteRows(rows, offset)
          : saveRows(
              objectDescribe,
              op,
              externalIdField,
              rows,
              clearEmptyValues == true,
              offset
            );
      } finally {
        if (savepoint != null) {
          Database.rollback(savepoint);
        }
      }
      return results;
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }

  private static List<RowResult> deleteRows(
    List<Map<String, String>> rows,
    Integer offset
  ) {
    List<RowResult> results = new List<RowResult>();
    List<Id> ids = new List<Id>();
    List<RowResult> pending = new List<RowResult>();
    for (Integer i = 0; i < rows.size(); i++) {
      RowResult result = new RowResult(offset + i);
      results.add(result);
      try {
        ids.add(Id.valueOf(rows[i].get('Id')));
        pending.add(result);
      } catch (Exception e) {
        result.error = 'Invalid Id: ' + rows[i].get('Id');
      }
    }
    if (!ids.isEmpty()) {
      List<Database.DeleteResult> saveResults = Database.delete(
        ids,
        false,
        AccessLevel.USER_MODE
      );
      for (Integer i = 0; i < saveResults.size(); i++) {
        pending[i].success = saveResults[i].isSuccess();
        pending[i].id = ids[i];
        pending[i].error = joinErrors(saveResults[i].getErrors());
      }
    }
    return results;
  }

  private static List<RowResult> saveRows(
    Schema.DescribeSObjectResult objectDescribe,
    String op,
    String externalIdField,
    List<Map<String, String>> rows,
    Boolean clearEmptyValues,
    Integer offset
  ) {
    Map<String, Schema.SObjectField> fieldMap = objectDescribe.fields.getMap();
    Schema.SObjectField upsertKey;
    if (op == 'upsert') {
      upsertKey = String.isBlank(externalIdField)
        ? null
        : fieldMap.get(externalIdField);
      if (upsertKey == null) {
        throw new SFI_Exception('Choose an external Id field for upsert.');
      }
    }

    Schema.SObjectType sObjectType = objectDescribe.getSObjectType();
    // Upsert needs a concretely typed list.
    List<SObject> records = (List<SObject>) Type.forName(
        'List<' + objectDescribe.getName() + '>'
      )
      .newInstance();
    List<RowResult> results = new List<RowResult>();
    List<RowResult> pending = new List<RowResult>();

    for (Integer i = 0; i < rows.size(); i++) {
      RowResult result = new RowResult(offset + i);
      results.add(result);
      try {
        records.add(
          buildRecord(sObjectType, fieldMap, op, rows[i], clearEmptyValues)
        );
        pending.add(result);
      } catch (Exception e) {
        result.error = e.getMessage();
      }
    }
    if (records.isEmpty()) {
      return results;
    }

    if (op == 'insert') {
      applySaveResults(
        Database.insert(records, false, AccessLevel.USER_MODE),
        pending,
        true
      );
    } else if (op == 'update') {
      applySaveResults(
        Database.update(records, false, AccessLevel.USER_MODE),
        pending,
        false
      );
    } else {
      List<Database.UpsertResult> upsertResults = Database.upsert(
        records,
        upsertKey,
        false,
        AccessLevel.USER_MODE
      );
      for (Integer i = 0; i < upsertResults.size(); i++) {
        pending[i].success = upsertResults[i].isSuccess();
        pending[i].id = upsertResults[i].getId();
        pending[i].created = upsertResults[i].isCreated();
        pending[i].error = joinErrors(upsertResults[i].getErrors());
      }
    }
    return results;
  }

  private static void applySaveResults(
    List<Database.SaveResult> saveResults,
    List<RowResult> pending,
    Boolean created
  ) {
    for (Integer i = 0; i < saveResults.size(); i++) {
      pending[i].success = saveResults[i].isSuccess();
      pending[i].id = saveResults[i].getId();
      pending[i].created = created && saveResults[i].isSuccess();
      pending[i].error = joinErrors(saveResults[i].getErrors());
    }
  }

  private static SObject buildRecord(
    Schema.SObjectType sObjectType,
    Map<String, Schema.SObjectField> fieldMap,
    String op,
    Map<String, String> row,
    Boolean clearEmptyValues
  ) {
    SObject record = sObjectType.newSObject();
    for (String fieldName : row.keySet()) {
      Schema.SObjectField field = fieldMap.get(fieldName);
      if (field == null) {
        throw new SFI_Exception('Unknown field: ' + fieldName);
      }
      String value = row.get(fieldName);
      Boolean isEmpty = String.isBlank(value);
      if (isEmpty && !clearEmptyValues) {
        continue;
      }
      Schema.DescribeFieldResult d = field.getDescribe();
      if (d.getName() == 'Id') {
        if (op != 'insert' && !isEmpty) {
          record.put('Id', Id.valueOf(value.trim()));
        }
        continue;
      }
      record.put(d.getName(), isEmpty ? null : convert(value, d));
    }
    if (op == 'update' && record.get('Id') == null) {
      throw new SFI_Exception('Id is required for update.');
    }
    return record;
  }

  @TestVisible
  private static Object convert(String raw, Schema.DescribeFieldResult d) {
    String value = raw.trim();
    try {
      switch on d.getType() {
        when BOOLEAN {
          String lower = value.toLowerCase();
          if (new Set<String>{ 'true', '1', 'yes', 'y', 'x' }.contains(lower)) {
            return true;
          }
          if (new Set<String>{ 'false', '0', 'no', 'n' }.contains(lower)) {
            return false;
          }
          throw new SFI_Exception('not a boolean');
        }
        when INTEGER {
          return Integer.valueOf(value);
        }
        when LONG {
          return Long.valueOf(value);
        }
        when DOUBLE, CURRENCY, PERCENT {
          return Decimal.valueOf(value.replace(',', '.'));
        }
        when DATE {
          return value.contains('/') ? Date.parse(value) : Date.valueOf(value);
        }
        when DATETIME {
          return (Datetime) JSON.deserialize('"' + value + '"', Datetime.class);
        }
        when TIME {
          List<String> parts = value.split(':');
          return Time.newInstance(
            Integer.valueOf(parts[0]),
            Integer.valueOf(parts[1]),
            parts.size() > 2 ? Integer.valueOf(parts[2].left(2)) : 0,
            0
          );
        }
        when REFERENCE, ID {
          return Id.valueOf(value);
        }
        when else {
          return raw;
        }
      }
    } catch (Exception e) {
      throw new SFI_Exception(
        'Invalid ' +
          d.getType().name().toLowerCase() +
          ' for ' +
          d.getName() +
          ': ' +
          raw
      );
    }
  }

  private static String joinErrors(List<Database.Error> errors) {
    if (errors == null || errors.isEmpty()) {
      return null;
    }
    List<String> messages = new List<String>();
    for (Database.Error error : errors) {
      String fields = error.getFields() == null || error.getFields().isEmpty()
        ? ''
        : ' [' + String.join(error.getFields(), ', ') + ']';
      messages.add(error.getStatusCode() + ': ' + error.getMessage() + fields);
    }
    return String.join(messages, ' | ');
  }
}
