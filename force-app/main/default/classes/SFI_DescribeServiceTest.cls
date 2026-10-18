@IsTest
private class SFI_DescribeServiceTest {
  @IsTest
  static void getObjectInfoReturnsAccount() {
    SFI_DescribeService.ObjectInfo info = SFI_DescribeService.getObjectInfo(
      'Account'
    );
    Assert.areEqual('Account', info.name);
    Assert.areEqual('001', info.keyPrefix);
  }

  @IsTest
  static void getObjectInfoRejectsUnknownObject() {
    try {
      SFI_DescribeService.getObjectInfo('Nope__c');
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('Unknown object'), e.getMessage());
    }
  }
}
