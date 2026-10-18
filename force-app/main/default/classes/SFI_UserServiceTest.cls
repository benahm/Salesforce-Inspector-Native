@IsTest
private class SFI_UserServiceTest {
  @IsTest
  static void getUserDefaultsToRunningUser() {
    SFI_UserService.UserDetails details = SFI_UserService.getUser(null);
    Assert.areEqual(UserInfo.getUserId(), details.id);
    Assert.isTrue(details.isCurrentUser);
    Assert.areEqual(UserInfo.getOrganizationId(), details.orgId);
  }

  @IsTest
  static void searchUsersFindsRunningUser() {
    String alias = [SELECT Alias FROM User WHERE Id = :UserInfo.getUserId()]
    .Alias;
    Boolean found = false;
    for (
      SFI_UserService.UserDetails details : SFI_UserService.searchUsers(alias)
    ) {
      found = found || details.id == UserInfo.getUserId();
    }
    Assert.isTrue(found, 'Running user should be found by alias');
    Assert.isTrue(SFI_UserService.searchUsers('a').isEmpty());
  }

  @IsTest
  static void setDebugModeTogglesPreference() {
    SFI_UserService.UserDetails details = SFI_UserService.setDebugMode(
      UserInfo.getUserId(),
      true
    );
    Assert.isTrue(details.debugMode);
    details = SFI_UserService.setDebugMode(UserInfo.getUserId(), false);
    Assert.isFalse(details.debugMode);
  }

  @IsTest
  static void getUserRejectsInvalidId() {
    try {
      SFI_UserService.getUser('nope');
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isNotNull(e.getMessage());
    }
  }
}
