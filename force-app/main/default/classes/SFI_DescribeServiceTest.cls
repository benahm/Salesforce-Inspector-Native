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
  static void listObjectsIncludesAccount() {
    Boolean found = false;
    for (
      SFI_DescribeService.ObjectInfo info : SFI_DescribeService.listObjects()
    ) {
      found = found || info.name == 'Account';
    }
    Assert.isTrue(found, 'Account should be listed');
  }

  @IsTest
  static void getFieldsReturnsRelationships() {
    Boolean hasAccount = false;
    for (
      SFI_DescribeService.FieldInfo field : SFI_DescribeService.getFields(
        'Contact'
      )
    ) {
      if (field.name == 'AccountId') {
        hasAccount =
          field.relationshipName == 'Account' &&
          field.referenceTo.contains('Account');
      }
    }
    Assert.isTrue(hasAccount, 'AccountId should reference Account');
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
