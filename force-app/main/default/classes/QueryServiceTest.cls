@IsTest
private class QueryServiceTest {
  @TestSetup
  static void setup() {
    Account account = new Account(Name = 'SFI Query Account');
    insert account;
    insert new List<Contact>{
      new Contact(LastName = 'SFI One', AccountId = account.Id),
      new Contact(LastName = 'SFI Two', AccountId = account.Id)
    };
  }

  @IsTest
  static void runQueryReturnsRecordsWithRelationships() {
    QueryService.QueryResult result = QueryService.runQuery(
      'SELECT Id, LastName, Account.Name FROM Contact ORDER BY LastName;',
      2000
    );
    Assert.areEqual(2, result.size);
    Assert.isFalse(result.hasMore);
    List<Object> rows = (List<Object>) JSON.deserializeUntyped(
      result.recordsJson
    );
    Map<String, Object> first = (Map<String, Object>) rows[0];
    Assert.areEqual('SFI One', first.get('LastName'));
    Map<String, Object> account = (Map<String, Object>) first.get('Account');
    Assert.areEqual('SFI Query Account', account.get('Name'));
  }

  @IsTest
  static void runQueryStopsAtMaxRows() {
    QueryService.QueryResult result = QueryService.runQuery(
      'SELECT Id FROM Contact',
      1
    );
    Assert.areEqual(1, result.size);
    Assert.isTrue(result.hasMore);
  }

  @IsTest
  static void runQuerySupportsCountAndAggregates() {
    QueryService.QueryResult countResult = QueryService.runQuery(
      'SELECT COUNT() FROM Contact',
      null
    );
    Assert.areEqual(2, countResult.count);

    QueryService.QueryResult aggregate = QueryService.runQuery(
      'SELECT AccountId, COUNT(Id) total FROM Contact GROUP BY AccountId',
      2000
    );
    Assert.areEqual(1, aggregate.size);
  }

  @IsTest
  static void runQueryRejectsNonSelect() {
    try {
      QueryService.runQuery('DELETE FROM Contact', 10);
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('Only SELECT'), e.getMessage());
    }
  }

  @IsTest
  static void runQueryReportsInvalidSoql() {
    try {
      QueryService.runQuery('SELECT Nope__c FROM Contact', 10);
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('Nope__c'), e.getMessage());
    }
  }
}
