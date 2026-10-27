@IsTest
private class SFI_SetupServiceTest {
  private class StubStore implements SFI_SetupService.LayoutStore {
    Metadata.Layout layout;
    Metadata.Layout deployed;

    public Metadata.Layout retrieve(String layoutName) {
      return layout;
    }

    public Id deploy(Metadata.Layout layout) {
      deployed = layout;
      return '0Af000000000001AAA';
    }
  }

  private static StubStore stub(Metadata.Layout layout) {
    StubStore store = new StubStore();
    store.layout = layout;
    SFI_SetupService.store = store;
    return store;
  }

  private static Metadata.Layout classicLayout() {
    Metadata.Layout layout = new Metadata.Layout();
    layout.fullName = SFI_SetupService.GLOBAL_LAYOUT;
    layout.quickActionList = new Metadata.QuickActionList();
    layout.quickActionList.quickActionListItems = new List<Metadata.QuickActionListItem>();
    for (String name : new List<String>{ 'FeedItem.TextPost', 'NewTask' }) {
      Metadata.QuickActionListItem item = new Metadata.QuickActionListItem();
      item.quickActionName = name;
      layout.quickActionList.quickActionListItems.add(item);
    }
    return layout;
  }

  private static List<String> actionNames(Metadata.Layout layout) {
    List<String> names = new List<String>();
    for (
      Metadata.PlatformActionListItem item : layout.platformActionList.platformActionListItems
    ) {
      names.add(item.sortOrder + ':' + item.actionName);
    }
    return names;
  }

  @IsTest
  static void addCopiesClassicActionsAndPutsActionFirst() {
    StubStore store = stub(classicLayout());
    Id jobId = SFI_SetupService.addGlobalAction();
    Assert.isNotNull(jobId);
    Assert.areEqual(
      new List<String>{ '0:' + SFI_SetupService.actionName(), '1:NewTask' },
      actionNames(store.deployed)
    );
    Assert.areEqual(
      Metadata.PlatformActionListContextEnum.Global_x,
      store.deployed.platformActionList.actionListContext
    );
  }

  @IsTest
  static void statusReflectsTheLayout() {
    StubStore store = stub(classicLayout());
    Assert.isFalse(SFI_SetupService.getStatus().hasGlobalAction);
    SFI_SetupService.addGlobalAction();
    store.layout = store.deployed;
    SFI_SetupService.Status status = SFI_SetupService.getStatus();
    Assert.isTrue(status.hasGlobalAction);
    Assert.isTrue(status.canCustomize);
    Assert.areEqual(SFI_SetupService.GLOBAL_LAYOUT, status.layoutName);
  }

  @IsTest
  static void addTwiceDoesNotDeploy() {
    StubStore store = stub(classicLayout());
    SFI_SetupService.addGlobalAction();
    store.layout = store.deployed;
    store.deployed = null;
    Assert.isNull(SFI_SetupService.addGlobalAction());
    Assert.isNull(store.deployed);
  }

  @IsTest
  static void removeDropsActionAndRenumbers() {
    StubStore store = stub(classicLayout());
    SFI_SetupService.addGlobalAction();
    store.layout = store.deployed;
    Assert.isNotNull(SFI_SetupService.removeGlobalAction());
    Assert.areEqual(
      new List<String>{ '0:NewTask' },
      actionNames(store.deployed)
    );
  }

  @IsTest
  static void removeWithoutActionDoesNotDeploy() {
    StubStore store = stub(classicLayout());
    Assert.isNull(SFI_SetupService.removeGlobalAction());
    Assert.isNull(store.deployed);
  }

  @IsTest
  static void userWithoutCustomizeApplicationIsRejected() {
    stub(classicLayout());
    User standardUser = new User(
      ProfileId = [SELECT Id FROM Profile WHERE Name = 'Standard User']
      .Id,
      LastName = 'SFI',
      Alias = 'sfisetup',
      Email = 'sfi.setup@example.com',
      Username = 'sfi.setup.' + Datetime.now().getTime() + '@example.com',
      TimeZoneSidKey = 'Europe/Paris',
      LocaleSidKey = 'fr_FR',
      EmailEncodingKey = 'UTF-8',
      LanguageLocaleKey = 'en_US'
    );
    insert standardUser;
    System.runAs(standardUser) {
      Assert.isFalse(SFI_SetupService.getStatus().canCustomize);
      try {
        SFI_SetupService.addGlobalAction();
        Assert.fail('An exception was expected');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('Customize Application'),
          e.getMessage()
        );
      }
    }
  }
}
