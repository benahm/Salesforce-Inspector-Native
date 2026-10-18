/**
 * Users tab of the launcher. Queries and DML run in USER_MODE.
 */
public with sharing class SFI_UserService {
  private static final Integer MAX_RESULTS = 20;
  private static final String USER_FIELDS =
    'Id, Name, Alias, Username, Email, ProfileId, Profile.Name, UserRole.Name, ' +
    'LanguageLocaleKey, LocaleSidKey, IsActive, UserPreferencesUserDebugModePref';

  public class UserDetails {
    @AuraEnabled
    public String id;
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String alias;
    @AuraEnabled
    public String username;
    @AuraEnabled
    public String email;
    @AuraEnabled
    public String profileId;
    @AuraEnabled
    public String profileName;
    @AuraEnabled
    public String roleName;
    @AuraEnabled
    public String language;
    @AuraEnabled
    public String locale;
    @AuraEnabled
    public Boolean isActive;
    @AuraEnabled
    public Boolean debugMode;
    @AuraEnabled
    public Boolean isCurrentUser;
    @AuraEnabled
    public String orgId;

    UserDetails(User u) {
      this.id = u.Id;
      this.name = u.Name;
      this.alias = u.Alias;
      this.username = u.Username;
      this.email = u.Email;
      this.profileId = u.ProfileId;
      this.profileName = u.Profile?.Name;
      this.roleName = u.UserRole?.Name;
      this.language = u.LanguageLocaleKey;
      this.locale = u.LocaleSidKey;
      this.isActive = u.IsActive;
      this.debugMode = u.UserPreferencesUserDebugModePref;
      this.isCurrentUser = u.Id == UserInfo.getUserId();
      this.orgId = UserInfo.getOrganizationId();
    }
  }

  /**
   * Details of a user; the running user when userId is blank.
   */
  @AuraEnabled
  public static UserDetails getUser(String userId) {
    try {
      Id targetId = String.isBlank(userId)
        ? UserInfo.getUserId()
        : Id.valueOf(userId);
      List<User> users = Database.queryWithBinds(
        'SELECT ' + USER_FIELDS + ' FROM User WHERE Id = :targetId LIMIT 1',
        new Map<String, Object>{ 'targetId' => targetId },
        AccessLevel.USER_MODE
      );
      if (users.isEmpty()) {
        throw new SFI_Exception('User not found: ' + userId);
      }
      return new UserDetails(users[0]);
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }

  @AuraEnabled
  public static List<UserDetails> searchUsers(String searchTerm) {
    try {
      String term = searchTerm == null ? '' : searchTerm.trim();
      List<UserDetails> result = new List<UserDetails>();
      if (term.length() < 2) {
        return result;
      }
      List<User> users = Database.queryWithBinds(
        'SELECT ' +
          USER_FIELDS +
          ' FROM User WHERE Name LIKE :likeTerm OR Username LIKE :likeTerm' +
          ' OR Email LIKE :likeTerm OR Alias LIKE :likeTerm' +
          ' ORDER BY IsActive DESC, Name LIMIT ' +
          MAX_RESULTS,
        new Map<String, Object>{ 'likeTerm' => '%' + term + '%' },
        AccessLevel.USER_MODE
      );
      for (User u : users) {
        result.add(new UserDetails(u));
      }
      return result;
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }

  /**
   * Turns Lightning debug mode on or off for a user.
   */
  @AuraEnabled
  public static UserDetails setDebugMode(String userId, Boolean enabled) {
    try {
      Database.update(
        new User(
          Id = Id.valueOf(userId),
          UserPreferencesUserDebugModePref = enabled == true
        ),
        true,
        AccessLevel.USER_MODE
      );
      return getUser(userId);
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }
}
