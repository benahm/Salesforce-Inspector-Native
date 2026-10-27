@IsTest
private class UserServiceTest {
  @IsTest
  static void getUserDefaultsToRunningUser() {
    UserService.UserDetails details = UserService.getUser(null);
    Assert.areEqual(UserInfo.getUserId(), details.id);
    Assert.isTrue(details.isCurrentUser);
    Assert.areEqual(UserInfo.getOrganizationId(), details.orgId);
  }

  @IsTest
  static void searchUsersFindsRunningUser() {
    String alias = [SELECT Alias FROM User WHERE Id = :UserInfo.getUserId()]
    .Alias;
    Boolean found = false;
    for (UserService.UserDetails details : UserService.searchUsers(alias)) {
      found = found || details.id == UserInfo.getUserId();
    }
    Assert.isTrue(found, 'Running user should be found by alias');
    Assert.isTrue(UserService.searchUsers('a').isEmpty());
  }

  @IsTest
  static void setDebugModeTogglesPreference() {
    UserService.UserDetails details = UserService.setDebugMode(
      UserInfo.getUserId(),
      true
    );
    Assert.isTrue(details.debugMode);
    details = UserService.setDebugMode(UserInfo.getUserId(), false);
    Assert.isFalse(details.debugMode);
  }

  @IsTest
  static void getUserRejectsInvalidId() {
    try {
      UserService.getUser('nope');
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isNotNull(e.getMessage());
    }
  }
}
