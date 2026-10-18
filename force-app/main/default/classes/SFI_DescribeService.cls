/**
 * Schema helpers shared by SF Inspector Native modules.
 */
public with sharing class SFI_DescribeService {
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

  /**
   * Returns the describe of an sObject, or throws a readable error when the name is unknown.
   */
  public static Schema.DescribeSObjectResult describe(String objectApiName) {
    Schema.SObjectType sObjectType = String.isBlank(objectApiName)
      ? null
      : Schema.getGlobalDescribe().get(objectApiName);
    if (sObjectType == null) {
      throw new SFI_Exception('Unknown object: ' + objectApiName);
    }
    return sObjectType.getDescribe(SObjectDescribeOptions.DEFERRED);
  }

  @AuraEnabled(cacheable=true)
  public static ObjectInfo getObjectInfo(String objectApiName) {
    try {
      return new ObjectInfo(describe(objectApiName));
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }
}
