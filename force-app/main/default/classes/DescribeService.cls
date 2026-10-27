/**
 * Schema helpers shared by SF Inspector Native modules.
 */
public with sharing class DescribeService {
  public class ObjectInfo {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String keyPrefix;
    @AuraEnabled
    public Boolean custom;
    @AuraEnabled
    public Boolean queryable;

    public ObjectInfo(Schema.DescribeSObjectResult d) {
      this.name = d.getName();
      this.label = d.getLabel();
      this.keyPrefix = d.getKeyPrefix();
      this.custom = d.isCustom();
      this.queryable = d.isQueryable();
    }
  }

  public class FieldInfo {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String type;
    @AuraEnabled
    public String relationshipName;
    @AuraEnabled
    public List<String> referenceTo = new List<String>();
  }

  /**
   * Returns the describe of an sObject, or throws a readable error when the name is unknown.
   */
  public static Schema.DescribeSObjectResult describe(String objectApiName) {
    Schema.SObjectType sObjectType = String.isBlank(objectApiName)
      ? null
      : Schema.getGlobalDescribe().get(objectApiName);
    if (sObjectType == null) {
      throw new InspectorException('Unknown object: ' + objectApiName);
    }
    return sObjectType.getDescribe(SObjectDescribeOptions.DEFERRED);
  }

  @AuraEnabled(cacheable=true)
  public static ObjectInfo getObjectInfo(String objectApiName) {
    try {
      return new ObjectInfo(describe(objectApiName));
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }

  /**
   * Queryable objects the user can access, used by SOQL autocomplete.
   */
  @AuraEnabled(cacheable=true)
  public static List<ObjectInfo> listObjects() {
    try {
      List<ObjectInfo> result = new List<ObjectInfo>();
      for (
        Schema.SObjectType sObjectType : Schema.getGlobalDescribe().values()
      ) {
        Schema.DescribeSObjectResult d = sObjectType.getDescribe(
          SObjectDescribeOptions.DEFERRED
        );
        if (d.isAccessible() && d.isQueryable()) {
          result.add(new ObjectInfo(d));
        }
      }
      return result;
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }

  /**
   * Accessible fields of an object, used by SOQL autocomplete.
   */
  @AuraEnabled(cacheable=true)
  public static List<FieldInfo> getFields(String objectApiName) {
    try {
      List<FieldInfo> result = new List<FieldInfo>();
      for (
        Schema.SObjectField field : describe(objectApiName)
          .fields.getMap()
          .values()
      ) {
        Schema.DescribeFieldResult d = field.getDescribe();
        if (!d.isAccessible()) {
          continue;
        }
        FieldInfo info = new FieldInfo();
        info.name = d.getName();
        info.label = d.getLabel();
        info.type = d.getType().name();
        info.relationshipName = d.getRelationshipName();
        for (Schema.SObjectType referenceType : d.getReferenceTo()) {
          info.referenceTo.add(referenceType.getDescribe().getName());
        }
        result.add(info);
      }
      return result;
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }
}
