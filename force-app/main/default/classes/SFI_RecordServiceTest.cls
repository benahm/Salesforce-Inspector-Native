@IsTest
private class SFI_RecordServiceTest {
  @TestSetup
  static void setup() {
    Account account = new Account(Name = 'SFI Test Account');
    insert account;
    insert new Contact(LastName = 'SFI Contact', AccountId = account.Id);
  }

  @IsTest
  static void getRecordReturnsAccessibleFields() {
    Account account = [SELECT Id FROM Account LIMIT 1];

    Test.startTest();
    SFI_RecordService.RecordData data = SFI_RecordService.getRecord(account.Id);
    Test.stopTest();

    Assert.areEqual('Account', data.objectApiName);
    Assert.areEqual('SFI Test Account', data.recordName);
    Boolean hasIdField = false;
    for (SFI_RecordService.FieldValue field : data.fields) {
      if (field.name == 'Id') {
        hasIdField = true;
        Assert.areEqual(String.valueOf(account.Id), field.value);
      }
    }
    Assert.isTrue(hasIdField, 'Id field should be returned');
    Boolean hasContacts = false;
    for (
      SFI_RecordService.ChildRelationshipInfo relationship : data.childRelationships
    ) {
      hasContacts = hasContacts || relationship.relationshipName == 'Contacts';
    }
    Assert.isTrue(hasContacts, 'Contacts relationship should be returned');
  }

  @IsTest
  static void getRecordRejectsInvalidId() {
    try {
      SFI_RecordService.getRecord('not-an-id');
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(
        e.getMessage().contains('Invalid record Id'),
        e.getMessage()
      );
    }
  }

  @IsTest
  static void countChildrenCountsContacts() {
    Account account = [SELECT Id FROM Account LIMIT 1];
    Assert.areEqual(
      1,
      SFI_RecordService.countChildren(account.Id, 'Contact', 'AccountId')
    );
  }

  @IsTest
  static void countChildrenRejectsUnknownField() {
    Account account = [SELECT Id FROM Account LIMIT 1];
    try {
      SFI_RecordService.countChildren(account.Id, 'Contact', 'Nope__c');
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('Unknown field'), e.getMessage());
    }
  }
}
