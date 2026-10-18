@IsTest
private class SFI_LimitsServiceTest {
  @IsTest
  static void getLimitsReturnsOrgCounters() {
    List<SFI_LimitsService.LimitInfo> limits = SFI_LimitsService.getLimits();
    Assert.isFalse(limits.isEmpty(), 'Org limits should not be empty');
    Boolean hasApiRequests = false;
    for (SFI_LimitsService.LimitInfo info : limits) {
      Assert.isNotNull(info.name);
      hasApiRequests = hasApiRequests || info.name == 'DailyApiRequests';
    }
    Assert.isTrue(hasApiRequests, 'DailyApiRequests should be listed');
  }
}
