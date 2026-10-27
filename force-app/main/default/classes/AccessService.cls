/**
 * Access section of the SF Inspector Setup tab: gives users the User or the Admin
 * permission set, one user or many at once. Admin includes everything User grants,
 * so a user holds one of them.
 */
public with sharing class AccessService {
  @TestVisible
  private static final String USER_PERMISSION_SET = 'User';
  @TestVisible
  private static final String ADMIN_PERMISSION_SET = 'Admin';
  private static final String LEVEL_USER = 'User';
  private static final String LEVEL_ADMIN = 'Admin';
  private static final Integer MAX_CANDIDATES = 200;

  public class AccessRow {
    @AuraEnabled
    public String userId;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String username;
    // Only set by findUsersByLogin, to match the pasted emails
    @AuraEnabled
    public String email;
    @AuraEnabled
    public String profileName;
    @AuraEnabled
    public Boolean isActive;
    @AuraEnabled
    public Boolean isCurrentUser;
    // 'User', 'Admin', or null for a candidate without access
    @AuraEnabled
    public String level;

    AccessRow(User u) {
      this.userId = u.Id;
      this.name = u.Name;
      this.username = u.Username;
      this.profileName = u.Profile?.Name;
      this.isActive = u.IsActive;
      this.isCurrentUser = u.Id == UserInfo.getUserId();
    }
  }

  public class AccessList {
    @AuraEnabled
    public Boolean canAssign;
    @AuraEnabled
    public List<AccessRow> rows = new List<AccessRow>();
  }

  public class ProfileOption {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public Integer userCount;
  }

  /**
   * Users holding the User or Admin permission set, Admin first.
   */
  @AuraEnabled
  public static AccessList getAccessList() {
    try {
      AccessList result = new AccessList();
      result.canAssign = canAssign();
      Map<Id, String> levels = levelsByUser(null);
      if (levels.isEmpty()) {
        return result;
      }
      Set<Id> userIds = levels.keySet();
      List<AccessRow> admins = new List<AccessRow>();
      List<AccessRow> users = new List<AccessRow>();
      for (
        User u : (List<User>) Database.queryWithBinds(
          'SELECT Id, Name, Username, Profile.Name, IsActive FROM User' +
          ' WHERE Id IN :userIds ORDER BY Name',
          new Map<String, Object>{ 'userIds' => userIds },
          AccessLevel.USER_MODE
        )
      ) {
        AccessRow row = new AccessRow(u);
        row.level = levels.get(u.Id);
        if (row.level == LEVEL_ADMIN) {
          admins.add(row);
        } else {
          users.add(row);
        }
      }
      result.rows.addAll(admins);
      result.rows.addAll(users);
      return result;
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }

  /**
   * Active users matching a name, username, email or alias, and/or a profile, with
   * their current access. Up to 200 users.
   */
  @AuraEnabled
  public static List<AccessRow> findUsers(String searchTerm, String profileId) {
    try {
      String term = searchTerm == null ? '' : searchTerm.trim();
      List<AccessRow> result = new List<AccessRow>();
      if (term.length() < 2 && String.isBlank(profileId)) {
        return result;
      }
      String soql =
        'SELECT Id, Name, Username, Profile.Name, IsActive FROM User' +
        ' WHERE IsActive = TRUE AND UserType = \'Standard\'';
      if (term.length() >= 2) {
        soql += ' AND (Name LIKE :likeTerm OR Username LIKE :likeTerm OR Email LIKE :likeTerm OR Alias LIKE :likeTerm)';
      }
      if (String.isNotBlank(profileId)) {
        soql += ' AND ProfileId = :profileId';
      }
      soql += ' ORDER BY Name LIMIT ' + MAX_CANDIDATES;
      List<User> found = Database.queryWithBinds(
        soql,
        new Map<String, Object>{
          'likeTerm' => '%' +
          term +
          '%',
          'profileId' => String.isBlank(profileId)
            ? null
            : Id.valueOf(profileId)
        },
        AccessLevel.USER_MODE
      );
      Set<Id> userIds = new Map<Id, User>(found).keySet();
      Map<Id, String> levels = levelsByUser(userIds);
      for (User u : found) {
        AccessRow row = new AccessRow(u);
        row.level = levels.get(u.Id);
        result.add(row);
      }
      return result;
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }

  /**
   * Active users whose username or email is in a pasted list, with their current
   * access. Up to 200 logins.
   */
  @AuraEnabled
  public static List<AccessRow> findUsersByLogin(List<String> logins) {
    try {
      Set<String> values = new Set<String>();
      for (String login : logins == null ? new List<String>() : logins) {
        if (String.isNotBlank(login) && values.size() < MAX_CANDIDATES) {
          values.add(login.trim().toLowerCase());
        }
      }
      List<AccessRow> result = new List<AccessRow>();
      if (values.isEmpty()) {
        return result;
      }
      List<User> found = Database.queryWithBinds(
        'SELECT Id, Name, Username, Email, Profile.Name, IsActive FROM User' +
          ' WHERE IsActive = TRUE AND UserType = \'Standard\'' +
          ' AND (Username IN :logins OR Email IN :logins) ORDER BY Name',
        new Map<String, Object>{ 'logins' => values },
        AccessLevel.USER_MODE
      );
      Map<Id, String> levels = levelsByUser(new Map<Id, User>(found).keySet());
      for (User u : found) {
        AccessRow row = new AccessRow(u);
        row.email = u.Email;
        row.level = levels.get(u.Id);
        result.add(row);
      }
      return result;
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }

  /**
   * Profiles that have active standard users, to pick users by profile.
   */
  @AuraEnabled
  public static List<ProfileOption> getProfiles() {
    try {
      List<ProfileOption> result = new List<ProfileOption>();
      for (
        AggregateResult row : (List<AggregateResult>) Database.query(
          'SELECT ProfileId, Profile.Name profileName, COUNT(Id) userCount FROM User' +
            ' WHERE IsActive = TRUE AND UserType = \'Standard\'' +
            ' GROUP BY ProfileId, Profile.Name ORDER BY Profile.Name',
          AccessLevel.USER_MODE
        )
      ) {
        ProfileOption option = new ProfileOption();
        option.id = (String) row.get('ProfileId');
        option.name = (String) row.get('profileName');
        option.userCount = (Integer) row.get('userCount');
        result.add(option);
      }
      return result;
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }

  /**
   * Sets the access of users: 'User', 'Admin', or blank to remove it.
   */
  @AuraEnabled
  public static AccessList setAccess(List<String> userIds, String level) {
    try {
      if (!canAssign()) {
        throw new InspectorException(
          'The Assign Permission Sets permission is required to change the access.'
        );
      }
      if (
        String.isNotBlank(level) &&
        level != LEVEL_USER &&
        level != LEVEL_ADMIN
      ) {
        throw new InspectorException('Unknown access level: ' + level);
      }
      Set<Id> assigneeIds = new Set<Id>();
      for (String userId : userIds) {
        assigneeIds.add(Id.valueOf(userId));
      }
      Database.delete(assignments(assigneeIds), true, AccessLevel.USER_MODE);
      if (String.isNotBlank(level)) {
        Id permissionSetId = permissionSetIds()
          .get(
            level == LEVEL_ADMIN ? ADMIN_PERMISSION_SET : USER_PERMISSION_SET
          );
        List<PermissionSetAssignment> inserts = new List<PermissionSetAssignment>();
        for (Id assigneeId : assigneeIds) {
          inserts.add(
            new PermissionSetAssignment(
              AssigneeId = assigneeId,
              PermissionSetId = permissionSetId
            )
          );
        }
        Database.insert(inserts, true, AccessLevel.USER_MODE);
      }
      return getAccessList();
    } catch (Exception e) {
      throw InspectorException.toAura(e);
    }
  }

  private static Map<Id, String> levelsByUser(Set<Id> userIds) {
    Map<Id, String> levels = new Map<Id, String>();
    for (PermissionSetAssignment assignment : assignments(userIds)) {
      if (assignment.PermissionSet.Name == ADMIN_PERMISSION_SET) {
        levels.put(assignment.AssigneeId, LEVEL_ADMIN);
      } else if (!levels.containsKey(assignment.AssigneeId)) {
        levels.put(assignment.AssigneeId, LEVEL_USER);
      }
    }
    return levels;
  }

  // Direct assignments only: those coming from a permission set group cannot be deleted.
  // All users when userIds is null.
  private static List<PermissionSetAssignment> assignments(Set<Id> userIds) {
    String soql =
      'SELECT Id, AssigneeId, PermissionSet.Name FROM PermissionSetAssignment' +
      ' WHERE PermissionSetId IN :permissionSetIds AND PermissionSetGroupId = NULL';
    if (userIds != null) {
      soql += ' AND AssigneeId IN :userIds';
    }
    return Database.queryWithBinds(
      soql,
      new Map<String, Object>{
        'permissionSetIds' => permissionSetIds().values(),
        'userIds' => userIds
      },
      AccessLevel.USER_MODE
    );
  }

  // The permission sets of this package: with the namespace once installed.
  private static Map<String, Id> permissionSetIds() {
    String className = AccessService.class.getName();
    String namespace = className.contains('.')
      ? className.substringBefore('.')
      : null;
    Map<String, Id> idsByName = new Map<String, Id>();
    for (PermissionSet permissionSet : [
      SELECT Id, Name
      FROM PermissionSet
      WHERE
        Name IN (:USER_PERMISSION_SET, :ADMIN_PERMISSION_SET)
        AND NamespacePrefix = :namespace
    ]) {
      idsByName.put(permissionSet.Name, permissionSet.Id);
    }
    return idsByName;
  }

  private static Boolean canAssign() {
    return ![
        SELECT Id
        FROM PermissionSetAssignment
        WHERE
          AssigneeId = :UserInfo.getUserId()
          AND PermissionSet.PermissionsAssignPermissionSets = TRUE
        LIMIT 1
      ]
      .isEmpty();
  }
}
