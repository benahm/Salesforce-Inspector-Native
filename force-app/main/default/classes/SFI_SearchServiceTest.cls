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

  // The search lists unpackaged code only: once packaged, this class has a namespace.
  @IsTest
  static void searchApexFindsThisClassWhenUnpackaged() {
    Boolean isPackaged = SFI_SearchServiceTest.class.getName().contains('.');
    List<SFI_SearchService.SearchResult> results = SFI_SearchService.search(
      'ApexClass',
      'SFI_SearchServiceTest'
    );
    Assert.areEqual(isPackaged ? 0 : 1, results.size());
    for (SFI_SearchService.SearchResult result : results) {
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
