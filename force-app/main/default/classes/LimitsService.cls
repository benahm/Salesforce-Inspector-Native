/**
 * Org Limits tool: the same counters as REST /limits, read from Apex.
 */
public with sharing class LimitsService {
  public class LimitInfo {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Integer max;
    @AuraEnabled
    public Integer used;

    LimitInfo(System.OrgLimit orgLimit) {
      this.name = orgLimit.getName();
      this.max = orgLimit.getLimit();
      this.used = orgLimit.getValue();
    }
  }

  @AuraEnabled
  public static List<LimitInfo> getLimits() {
    try {
      List<LimitInfo> result = new List<LimitInfo>();
      for (System.OrgLimit orgLimit : OrgLimits.getAll()) {
        result.add(new LimitInfo(orgLimit));
      }
      return result;
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }
}
