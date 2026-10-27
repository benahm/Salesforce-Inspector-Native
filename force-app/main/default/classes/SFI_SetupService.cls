/**
 * SF Inspector Setup tab: adds or removes the SF Inspector global action in the
 * Global publisher layout with the Apex Metadata API, without callouts.
 */
public with sharing class SFI_SetupService {
  @TestVisible
  private static final String GLOBAL_LAYOUT = 'Global-Global Layout';
  private static final String ACTION = 'SFI_Inspector';

  @TestVisible
  private static LayoutStore store = new MetadataLayoutStore();

  public class Status {
    @AuraEnabled
    public Boolean hasGlobalAction;
    @AuraEnabled
    public Boolean canCustomize;
    @AuraEnabled
    public String layoutName;
    @AuraEnabled
    public String actionName;
  }

  /**
   * Reads and deploys layouts; replaced by a stub in tests, where Apex cannot deploy metadata.
   */
  public interface LayoutStore {
    Metadata.Layout retrieve(String layoutName);
    Id deploy(Metadata.Layout layout);
  }

  private class MetadataLayoutStore implements LayoutStore {
    public Metadata.Layout retrieve(String layoutName) {
      List<Metadata.Metadata> items = Metadata.Operations.retrieve(
        Metadata.MetadataType.Layout,
        new List<String>{ layoutName }
      );
      if (items.isEmpty()) {
        throw new SFI_Exception('Layout not found: ' + layoutName);
      }
      return (Metadata.Layout) items[0];
    }

    public Id deploy(Metadata.Layout layout) {
      Metadata.DeployContainer container = new Metadata.DeployContainer();
      container.addMetadata(layout);
      return Metadata.Operations.enqueueDeployment(container, null);
    }
  }

  @AuraEnabled
  public static Status getStatus() {
    try {
      Status status = new Status();
      status.layoutName = GLOBAL_LAYOUT;
      status.actionName = actionName();
      status.canCustomize = canCustomize();
      status.hasGlobalAction =
        status.canCustomize &&
        indexOfAction(store.retrieve(GLOBAL_LAYOUT)) >= 0;
      return status;
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }

  /**
   * Puts the action first in the Lightning global actions. Returns the deployment Id.
   */
  @AuraEnabled
  public static Id addGlobalAction() {
    try {
      Metadata.Layout layout = retrieveForUpdate();
      if (indexOfAction(layout) >= 0) {
        return null;
      }
      ensurePlatformActionList(layout);
      Metadata.PlatformActionListItem item = new Metadata.PlatformActionListItem();
      item.actionName = actionName();
      item.actionType = Metadata.PlatformActionTypeEnum.QuickAction;
      List<Metadata.PlatformActionListItem> items = layout.platformActionList.platformActionListItems;
      if (items.isEmpty()) {
        items.add(item);
      } else {
        items.add(0, item);
      }
      renumber(items);
      return store.deploy(layout);
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }

  /**
   * Removes the action from the Lightning global actions. Returns the deployment Id.
   */
  @AuraEnabled
  public static Id removeGlobalAction() {
    try {
      Metadata.Layout layout = retrieveForUpdate();
      Integer index = indexOfAction(layout);
      if (index < 0) {
        return null;
      }
      List<Metadata.PlatformActionListItem> items = layout.platformActionList.platformActionListItems;
      items.remove(index);
      renumber(items);
      return store.deploy(layout);
    } catch (Exception e) {
      throw SFI_Exception.toAura(e);
    }
  }

  private static Metadata.Layout retrieveForUpdate() {
    if (!canCustomize()) {
      throw new SFI_Exception(
        'The Customize Application permission is required to change the global actions.'
      );
    }
    return store.retrieve(GLOBAL_LAYOUT);
  }

  // Installed, the action carries the namespace (sfinative__SFI_Inspector), except
  // in the org that owns the namespace, where metadata names have no prefix.
  @TestVisible
  private static String actionName() {
    String className = SFI_SetupService.class.getName();
    if (!className.contains('.')) {
      return ACTION;
    }
    String namespace = className.substringBefore('.');
    String orgNamespace = [SELECT NamespacePrefix FROM Organization LIMIT 1]
    .NamespacePrefix;
    return namespace == orgNamespace ? ACTION : namespace + '__' + ACTION;
  }

  private static Boolean canCustomize() {
    return ![
        SELECT Id
        FROM PermissionSetAssignment
        WHERE
          AssigneeId = :UserInfo.getUserId()
          AND PermissionSet.PermissionsCustomizeApplication = TRUE
        LIMIT 1
      ]
      .isEmpty();
  }

  private static Integer indexOfAction(Metadata.Layout layout) {
    if (layout.platformActionList == null) {
      return -1;
    }
    String name = actionName();
    List<Metadata.PlatformActionListItem> items = layout.platformActionList.platformActionListItems;
    for (Integer i = 0; i < items.size(); i++) {
      if (items[i].actionName == name) {
        return i;
      }
    }
    return -1;
  }

  // Without a Lightning list, Lightning shows the classic quick actions: copy them
  // first so the other global actions stay in the menu. Chatter posts are not menu items.
  private static void ensurePlatformActionList(Metadata.Layout layout) {
    if (layout.platformActionList != null) {
      return;
    }
    Metadata.PlatformActionList actionList = new Metadata.PlatformActionList();
    actionList.actionListContext = Metadata.PlatformActionListContextEnum.Global_x;
    actionList.platformActionListItems = new List<Metadata.PlatformActionListItem>();
    if (layout.quickActionList != null) {
      for (
        Metadata.QuickActionListItem quickAction : layout.quickActionList.quickActionListItems
      ) {
        if (quickAction.quickActionName.startsWith('FeedItem.')) {
          continue;
        }
        Metadata.PlatformActionListItem item = new Metadata.PlatformActionListItem();
        item.actionName = quickAction.quickActionName;
        item.actionType = Metadata.PlatformActionTypeEnum.QuickAction;
        actionList.platformActionListItems.add(item);
      }
    }
    layout.platformActionList = actionList;
  }

  private static void renumber(List<Metadata.PlatformActionListItem> items) {
    for (Integer i = 0; i < items.size(); i++) {
      items[i].sortOrder = i;
    }
  }
}
