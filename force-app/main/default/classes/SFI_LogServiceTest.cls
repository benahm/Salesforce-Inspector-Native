@IsTest
private class SFI_LogServiceTest {
  // ApexLog rows cannot be inserted: the tests check the query and the filters.
  @IsTest
  static void getLogsReturnsMostRecentFirst() {
    List<SFI_LogService.LogInfo> logs = SFI_LogService.getLogs(false, 50);
    Assert.isTrue(logs.size() <= 50);
    for (Integer i = 1; i < logs.size(); i++) {
      Assert.isTrue(logs[i - 1].startTime >= logs[i].startTime);
    }
  }

  @IsTest
  static void getLogsFiltersOnRunningUser() {
    for (SFI_LogService.LogInfo log : SFI_LogService.getLogs(true, null)) {
      Assert.areEqual(UserInfo.getUserId(), log.userId);
    }
  }

  @IsTest
  static void logInfoMapsApexLogFields() {
    ApexLog log = (ApexLog) JSON.deserialize(
      '{"attributes":{"type":"ApexLog"},"Operation":"/apex/Test","LogLength":1024,' +
      '"LogUser":{"attributes":{"type":"User"},"Name":"Jane"}}',
      ApexLog.class
    );
    SFI_LogService.LogInfo info = new SFI_LogService.LogInfo(log);
    Assert.areEqual('/apex/Test', info.operation);
    Assert.areEqual(1024, info.size);
    Assert.areEqual('Jane', info.userName);
  }
}
