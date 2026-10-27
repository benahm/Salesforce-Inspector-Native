@IsTest
private class SearchServiceTest {
  @IsTest
  static void searchObjectsFindsAccount() {
    List<SearchService.SearchResult> results = SearchService.search(
      'Object',
      'Account'
    );
    Boolean found = false;
    for (SearchService.SearchResult result : results) {
      found = found || result.name == 'Account';
    }
    Assert.isTrue(found, 'Account should be found');
  }

  // The search lists unpackaged code only: once packaged, this class has a namespace.
  @IsTest
  static void searchApexFindsThisClassWhenUnpackaged() {
    Boolean isPackaged = SearchServiceTest.class.getName().contains('.');
    List<SearchService.SearchResult> results = SearchService.search(
      'ApexClass',
      'SearchServiceTest'
    );
    Assert.areEqual(isPackaged ? 0 : 1, results.size());
    for (SearchService.SearchResult result : results) {
      Assert.isTrue(result.url.startsWith('/lightning/setup/ApexClasses/'));
    }
  }

  @IsTest
  static void searchSupportsEveryMetadataType() {
    for (
      String metadataType : new List<String>{
        'ApexTrigger',
        'ApexPage',
        'Flow'
      }
    ) {
      Assert.isNotNull(SearchService.search(metadataType, ''), metadataType);
      Assert.isNotNull(SearchService.search(metadataType, 'a'), metadataType);
    }
  }

  @IsTest
  static void searchRejectsUnknownType() {
    try {
      SearchService.search('Nope', '');
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('Unsupported'), e.getMessage());
    }
  }
}
