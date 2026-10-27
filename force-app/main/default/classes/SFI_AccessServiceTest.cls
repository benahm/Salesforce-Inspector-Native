@IsTest
private class SFI_AccessServiceTest {
  private static List<User> newStandardUsers(Integer count) {
    Id profileId = [SELECT Id FROM Profile WHERE Name = 'Standard User'].Id;
    Long stamp = Datetime.now().getTime();
    List<User> users = new List<User>();
    for (Integer i = 0; i < count; i++) {
      users.add(
        new User(
          ProfileId = profileId,
          LastName = 'SFI Access ' + i,
          Alias = 'sfiacc' + i,
          Email = 'sfi.access@example.com',
          Username = 'sfi.access.' + i + '.' + stamp + '@example.com',
          TimeZoneSidKey = 'Europe/Paris',
          LocaleSidKey = 'fr_FR',
          EmailEncodingKey = 'UTF-8',
          LanguageLocaleKey = 'en_US'
        )
      );
    }
    insert users;
    return users;
  }

  private static List<String> idsOf(List<User> users) {
    List<String> ids = new List<String>();
    for (User u : users) {
      ids.add(u.Id);
    }
    return ids;
  }

  private static SFI_AccessService.AccessRow rowOf(
    List<SFI_AccessService.AccessRow> rows,
    Id userId
  ) {
    for (SFI_AccessService.AccessRow row : rows) {
      if (row.userId == userId) {
        return row;
      }
    }
    return null;
  }

  private static Integer assignmentCount(List<User> users) {
    return [
      SELECT COUNT()
      FROM PermissionSetAssignment
      WHERE
        AssigneeId IN :users
        AND PermissionSet.Name IN (
          :SFI_AccessService.USER_PERMISSION_SET,
          :SFI_AccessService.ADMIN_PERMISSION_SET
        )
    ];
  }

  @IsTest
  static void setAccessGivesChangesAndRemovesManyUsersAtOnce() {
    List<User> users = newStandardUsers(3);

    SFI_AccessService.AccessList accessList = SFI_AccessService.setAccess(
      idsOf(users),
      'User'
    );
    Assert.isTrue(accessList.canAssign);
    for (User u : users) {
      Assert.areEqual('User', rowOf(accessList.rows, u.Id).level);
    }

    accessList = SFI_AccessService.setAccess(idsOf(users), 'Admin');
    Assert.areEqual('Admin', rowOf(accessList.rows, users[0].Id).level);
    Assert.areEqual(3, assignmentCount(users), 'Admin replaces User');

    accessList = SFI_AccessService.setAccess(idsOf(users), null);
    Assert.isNull(rowOf(accessList.rows, users[0].Id));
    Assert.areEqual(0, assignmentCount(users));
  }

  @IsTest
  static void accessListPutsAdminsFirst() {
    List<User> users = newStandardUsers(2);
    SFI_AccessService.setAccess(new List<String>{ users[0].Id }, 'User');
    SFI_AccessService.setAccess(new List<String>{ users[1].Id }, 'Admin');
    List<SFI_AccessService.AccessRow> rows = SFI_AccessService.getAccessList()
      .rows;
    Assert.areEqual('Admin', rows[0].level);
    SFI_AccessService.AccessRow row = rowOf(rows, users[0].Id);
    Assert.areEqual('Standard User', row.profileName);
    Assert.isFalse(row.isCurrentUser);
  }

  @IsTest
  static void findUsersByNameOrProfileShowsTheirAccess() {
    List<User> users = newStandardUsers(2);
    SFI_AccessService.setAccess(new List<String>{ users[0].Id }, 'User');

    List<SFI_AccessService.AccessRow> found = SFI_AccessService.findUsers(
      'SFI Access',
      null
    );
    Assert.areEqual('User', rowOf(found, users[0].Id).level);
    Assert.isNull(rowOf(found, users[1].Id).level);

    found = SFI_AccessService.findUsers('', users[1].ProfileId);
    Assert.isNotNull(rowOf(found, users[1].Id));
    Assert.isTrue(SFI_AccessService.findUsers('a', null).isEmpty());
  }

  @IsTest
  static void findUsersByLoginMatchesUsernamesAndEmails() {
    List<User> users = newStandardUsers(2);
    SFI_AccessService.setAccess(new List<String>{ users[0].Id }, 'Admin');

    List<SFI_AccessService.AccessRow> found = SFI_AccessService.findUsersByLogin(
      new List<String>{ ' ' + users[0].Username.toUpperCase() + ' ', '', null }
    );
    Assert.areEqual(1, found.size());
    Assert.areEqual('Admin', found[0].level);

    // Both test users share the same email
    found = SFI_AccessService.findUsersByLogin(
      new List<String>{ 'SFI.Access@example.com' }
    );
    Assert.isNotNull(rowOf(found, users[1].Id));
    Assert.areEqual('sfi.access@example.com', rowOf(found, users[1].Id).email);
    Assert.isTrue(SFI_AccessService.findUsersByLogin(null).isEmpty());
  }

  @IsTest
  static void profilesCountTheirActiveUsers() {
    List<User> users = newStandardUsers(1);
    Boolean found = false;
    for (
      SFI_AccessService.ProfileOption option : SFI_AccessService.getProfiles()
    ) {
      if (option.id == users[0].ProfileId) {
        found = true;
        Assert.isTrue(option.userCount >= 1);
      }
    }
    Assert.isTrue(found, 'Standard User profile should be listed');
  }

  @IsTest
  static void setAccessRejectsUnknownLevel() {
    try {
      SFI_AccessService.setAccess(
        new List<String>{ UserInfo.getUserId() },
        'Owner'
      );
      Assert.fail('An exception was expected');
    } catch (AuraHandledException e) {
      Assert.isTrue(e.getMessage().contains('Owner'), e.getMessage());
    }
  }

  @IsTest
  static void userWithoutAssignPermissionSetsIsRejected() {
    User standardUser = newStandardUsers(1)[0];
    System.runAs(standardUser) {
      Assert.isFalse(SFI_AccessService.getAccessList().canAssign);
      try {
        SFI_AccessService.setAccess(
          new List<String>{ standardUser.Id },
          'User'
        );
        Assert.fail('An exception was expected');
      } catch (AuraHandledException e) {
        Assert.isTrue(
          e.getMessage().contains('Assign Permission Sets'),
          e.getMessage()
        );
      }
    }
  }
}
