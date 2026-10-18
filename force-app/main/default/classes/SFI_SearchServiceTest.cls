@IsTest
private class SFI_SearchServiceTest {
  @IsTest
  static void searchObjectsFindsAccount() {
    List<SFI_SearchService.SearchResult> results = SFI_SearchService.search(
      'Object',
      'Account'
    );
    Boolean found = false;
    for (SFI_SearchService.SearchResult result : results) {
      found = found || result.name == 'Account';
    }
    Assert.isTrue(found, 'Account should be found');
  }

  @IsTest
  static void searchApexFindsThisClass() {
    List<SFI_SearchService.SearchResult> results = SFI_SearchService.search(
      'ApexClass',
      'SFI_SearchServiceTest'
    );
    Assert.areEqual(1, results.size());
    Assert.isTrue(results[0].url.startsWith('/lightning/setup/ApexClasses/'));
  }

  @IsTest
  static void searchSupportsEveryMetadataType() {
    for (
      String metadataType : new List<String>{
        'CustomLabel',
        'ApexTrigger',
        'ApexPage',
        'Flow'
      }
    ) {
      Assert.isNotNull(
        SFI_SearchService.search(metadataType, ''),
        metadataType
      );
      Assert.isNotNull(
        SFI_SearchService.search(metadataType, 'a'),
        metadataType
      );
    }
  }

  @IsTest
  static void searchRejectsUnknownType() {
    try {
      SFI_SearchService.search('Nope', '');
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('Unsupported'), e.getMessage());
    }
  }
}
