/**
 * Reads a record with every field the running user can see (Show All Data).
 * All queries run in USER_MODE: sharing, CRUD and FLS of the user are enforced.
 */
public with sharing class SFI_RecordService {
  public class RecordData {
    @AuraEnabled
    public String recordId;
    @AuraEnabled
    public String objectApiName;
    @AuraEnabled
    public String objectLabel;
    @AuraEnabled
    public String recordName;
    @AuraEnabled
    public Boolean updateable;
    @AuraEnabled
    public List<FieldValue> fields = new List<FieldValue>();
    @AuraEnabled
    public List<ChildRelationshipInfo> childRelationships = new List<ChildRelationshipInfo>();
  }

  public class FieldValue {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String type;
    @AuraEnabled
    public String value;
    @AuraEnabled
    public String referenceTo;
    @AuraEnabled
    public Boolean updateable;
    @AuraEnabled
    public Boolean calculated;
    @AuraEnabled
    public Boolean custom;
    @AuraEnabled
    public Boolean nameField;
    @AuraEnabled
    public String helpText;
  }

  public class ChildRelationshipInfo {
    @AuraEnabled
    public String relationshipName;
    @AuraEnabled
    public String childObject;
    @AuraEnabled
    public String childObjectLabel;
    @AuraEnabled
    public String field;
  }

  @AuraEnabled
  public static RecordData getRecord(String recordId) {
    try {
      Id parsedId = parseId(recordId);
      Schema.DescribeSObjectResult objectDescribe = parsedId.getSObjectType()
        .getDescribe();
      if (!objectDescribe.isQueryable()) {
        throw new SFI_Exception(
          objectDescribe.getName() + ' cannot be queried.'
        );
      }

      List<Schema.DescribeFieldResult> fieldDescribes = new List<Schema.DescribeFieldResult>();
      for (
        Schema.SObjectField field : objectDescribe.fields.getMap().values()
      ) {
        Schema.DescribeFieldResult fieldDescribe = field.getDescribe();
        if (fieldDescribe.isAccessible()) {
          fieldDescribes.add(fieldDescribe);
        }
      }

      SObject record = queryRecord(
        parsedId,
        objectDescribe.getName(),
        fieldDescribes
      );

      RecordData data = new RecordData();
      data.recordId = parsedId;
      data.objectApiName = objectDescribe.getName();
      data.objectLabel = objectDescribe.getLabel();
      data.updateable = objectDescribe.isUpdateable();
      for (Schema.DescribeFieldResult fieldDescribe : fieldDescribes) {
        FieldValue fieldValue = toFieldValue(fieldDescribe, record);
        // Person accounts expose several name fields: prefer Name when it is set.
        if (
          fieldValue.nameField &&
          fieldValue.value != null &&
          (data.recordName == null ||
          fieldValue.name == 'Name')
        ) {
          data.recordName = fieldValue.value;
        }
        data.fields.add(fieldValue);
      }
      data.childRelationships = getChildRelationships(objectDescribe);
      return data;
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }

  /**
   * Counts the child records of a relationship. Object and field are validated against the schema.
   */
  @AuraEnabled
  public static Integer countChildren(
    String recordId,
    String childObject,
    String field
  ) {
    try {
      Id parsedId = parseId(recordId);
      Schema.DescribeSObjectResult childDescribe = SFI_DescribeService.describe(
        childObject
      );
      Schema.SObjectField childField = childDescribe.fields.getMap().get(field);
      if (childField == null) {
        throw new SFI_Exception('Unknown field: ' + childObject + '.' + field);
      }
      String soql =
        'SELECT COUNT() FROM ' +
        childDescribe.getName() +
        ' WHERE ' +
        childField.getDescribe().getName() +
        ' = :parentId';
      return Database.countQueryWithBinds(
        soql,
        new Map<String, Object>{ 'parentId' => parsedId },
        AccessLevel.USER_MODE
      );
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }

  private static Id parseId(String recordId) {
    try {
      return Id.valueOf(recordId == null ? '' : recordId.trim());
    } catch (Exception e) {
      throw new SFI_Exception('Invalid record Id: ' + recordId);
    }
  }

  private static SObject queryRecord(
    Id recordId,
    String objectApiName,
    List<Schema.DescribeFieldResult> fieldDescribes
  ) {
    List<String> fieldNames = new List<String>();
    for (Schema.DescribeFieldResult fieldDescribe : fieldDescribes) {
      fieldNames.add(fieldDescribe.getName());
    }
    String soql =
      'SELECT ' +
      String.join(fieldNames, ', ') +
      ' FROM ' +
      objectApiName +
      ' WHERE Id = :recordId LIMIT 1';
    List<SObject> records = Database.queryWithBinds(
      soql,
      new Map<String, Object>{ 'recordId' => recordId },
      AccessLevel.USER_MODE
    );
    if (records.isEmpty()) {
      throw new SFI_Exception(
        'Record not found or not accessible: ' + recordId
      );
    }
    return records[0];
  }

  private static FieldValue toFieldValue(
    Schema.DescribeFieldResult fieldDescribe,
    SObject record
  ) {
    FieldValue fieldValue = new FieldValue();
    fieldValue.name = fieldDescribe.getName();
    fieldValue.label = fieldDescribe.getLabel();
    fieldValue.type = fieldDescribe.getType().name();
    fieldValue.updateable = fieldDescribe.isUpdateable();
    fieldValue.calculated = fieldDescribe.isCalculated();
    fieldValue.custom = fieldDescribe.isCustom();
    fieldValue.nameField = fieldDescribe.isNameField();
    fieldValue.helpText = fieldDescribe.getInlineHelpText();
    List<String> referenceTo = new List<String>();
    for (Schema.SObjectType referenceType : fieldDescribe.getReferenceTo()) {
      referenceTo.add(referenceType.getDescribe().getName());
    }
    fieldValue.referenceTo = String.join(referenceTo, ', ');
    fieldValue.value = formatValue(
      record.get(fieldDescribe.getName()),
      fieldDescribe.getType()
    );
    return fieldValue;
  }

  private static String formatValue(Object value, Schema.DisplayType type) {
    if (value == null) {
      return null;
    }
    if (type == Schema.DisplayType.BASE64) {
      return '(binary)';
    }
    if (value instanceof Datetime) {
      return ((Datetime) value).formatGmt('yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'');
    }
    if (value instanceof Date) {
      return String.valueOf((Date) value);
    }
    if (value instanceof Address || value instanceof Location) {
      return JSON.serialize(value, true);
    }
    return String.valueOf(value);
  }

  private static List<ChildRelationshipInfo> getChildRelationships(
    Schema.DescribeSObjectResult objectDescribe
  ) {
    List<ChildRelationshipInfo> result = new List<ChildRelationshipInfo>();
    for (
      Schema.ChildRelationship relationship : objectDescribe.getChildRelationships()
    ) {
      if (relationship.getRelationshipName() == null) {
        continue;
      }
      Schema.DescribeSObjectResult childDescribe = relationship.getChildSObject()
        .getDescribe();
      if (!childDescribe.isAccessible() || !childDescribe.isQueryable()) {
        continue;
      }
      ChildRelationshipInfo info = new ChildRelationshipInfo();
      info.relationshipName = relationship.getRelationshipName();
      info.childObject = childDescribe.getName();
      info.childObjectLabel = childDescribe.getLabel();
      info.field = relationship.getField().getDescribe().getName();
      result.add(info);
    }
    return result;
  }
}
