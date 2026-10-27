@IsTest
private class LimitsServiceTest {
  @IsTest
  static void getLimitsReturnsOrgCounters() {
    List<LimitsService.LimitInfo> limits = LimitsService.getLimits();
    Assert.isFalse(limits.isEmpty(), 'Org limits should not be empty');
    Boolean hasApiRequests = false;
    for (LimitsService.LimitInfo info : limits) {
      Assert.isNotNull(info.name);
      hasApiRequests = hasApiRequests || info.name == 'DailyApiRequests';
    }
    Assert.isTrue(hasApiRequests, 'DailyApiRequests should be listed');
  }
}
