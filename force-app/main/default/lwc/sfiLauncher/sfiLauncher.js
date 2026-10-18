import { LightningElement, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getRecord from "@salesforce/apex/SFI_RecordService.getRecord";
import getObjectInfo from "@salesforce/apex/SFI_DescribeService.getObjectInfo";
import search from "@salesforce/apex/SFI_SearchService.search";
import getUser from "@salesforce/apex/SFI_UserService.getUser";
import searchUsers from "@salesforce/apex/SFI_UserService.searchUsers";
import setDebugMode from "@salesforce/apex/SFI_UserService.setDebugMode";
import {
  containsIgnoreCase,
  copyToClipboard,
  dataExportUrl,
  dataImportUrl,
  debounce,
  highlight,
  isSalesforceId,
  OBJECT_SETUP_PAGES,
  recordUrl,
  objectSetupUrl,
  reduceErrors,
  showAllDataUrl,
  TOOL_SECTIONS,
  VERSION
} from "c/sfiUtils";

const SUMMARY_FIELDS = [
  "RecordTypeId",
  "OwnerId",
  "CreatedById",
  "CreatedDate",
  "LastModifiedById",
  "LastModifiedDate"
];

export default class SfiLauncher extends LightningElement {
  version = VERSION;

  // Page context
  recordId;
  objectApiName;
  record;
  objectInfo;
  contextError;
  isLoadingContext = false;

  fieldFilter = "";
  idInput = "";

  // Search tab
  searchType = "Object";
  searchTerm = "";
  searchResults = [];
  searchError;
  isSearching = false;
  searchTypes = [
    { label: "Objects", value: "Object" },
    { label: "Custom Labels", value: "CustomLabel" },
    { label: "Apex Classes", value: "ApexClass" },
    { label: "Apex Triggers", value: "ApexTrigger" },
    { label: "Visualforce Pages", value: "ApexPage" },
    { label: "Flows", value: "Flow" }
  ];

  // Users tab
  user;
  userSearch = "";
  userResults = [];
  userError;
  isLoadingUser = false;
  isSavingUser = false;

  activeTab = "context";
  availableHeight;

  constructor() {
    super();
    this.debouncedSearch = debounce(() => this.runSearch(), 300);
    this.debouncedUserSearch = debounce(() => this.runUserSearch(), 300);
    this.resizeHandler = () => this.updateHeight();
  }

  connectedCallback() {
    window.addEventListener("resize", this.resizeHandler);
    // The docked panel slides in: measure again once the animation is over.
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this.resizeTimeout = setTimeout(this.resizeHandler, 400);
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this.resizeHandler);
    clearTimeout(this.resizeTimeout);
  }

  renderedCallback() {
    this.updateHeight();
  }

  // The docked composer is anchored to the bottom of the viewport: fill the space down to it.
  updateHeight() {
    const top = this.template.host.getBoundingClientRect().top;
    const height = Math.max(300, Math.floor(window.innerHeight - top - 1));
    if (height !== this.availableHeight) {
      this.availableHeight = height;
    }
  }

  get rootStyle() {
    return this.availableHeight ? `height: ${this.availableHeight}px` : "";
  }

  get tabs() {
    // Same order as Salesforce Inspector Reloaded, then the native extras.
    const tabs = [
      { value: "context", label: "Objects" },
      { value: "users", label: "Users" },
      { value: "search", label: "Search" },
      { value: "tools", label: "Tools", icon: "utility:apps" }
    ];
    return tabs.map((tab) => ({
      ...tab,
      selected: String(tab.value === this.activeTab),
      itemClass:
        "slds-tabs_default__item" +
        (tab.value === this.activeTab ? " slds-is-active" : "")
    }));
  }

  get isContextTab() {
    return this.activeTab === "context";
  }

  get isSearchTab() {
    return this.activeTab === "search";
  }

  get isToolsTab() {
    return this.activeTab === "tools";
  }

  get showAllDataUrl() {
    return showAllDataUrl(this.record?.recordId);
  }

  get recordViewUrl() {
    return recordUrl(this.record?.recordId);
  }

  // Tools receive the current object so they open pre-filled.
  get toolSections() {
    const objectApiName = this.objectApiName;
    const urls = {
      dataExport: dataExportUrl(
        objectApiName ? `SELECT Id FROM ${objectApiName} LIMIT 100` : null
      ),
      dataImport: dataImportUrl(objectApiName)
    };
    return TOOL_SECTIONS.map((section) => ({
      ...section,
      tools: section.tools.map((tool) => {
        const url = tool.key ? urls[tool.key] : null;
        return {
          label: tool.label,
          url,
          soon: !url,
          ariaDisabled: url ? "false" : "true",
          title: url ? `Open ${tool.label} in a new tab` : "Coming soon",
          className: url
            ? "slds-button slds-button_neutral sfi-tool"
            : "slds-button slds-button_neutral sfi-tool sfi-soon"
        };
      })
    }));
  }

  handleToolClick(event) {
    if (!event.currentTarget.getAttribute("href")) {
      event.preventDefault();
    }
  }

  handleTab(event) {
    event.preventDefault();
    this.activeTab = event.currentTarget.dataset.tab;
    if (this.activeTab === "search" && !this.searchResults.length) {
      this.runSearch();
    }
    if (this.activeTab === "users" && !this.user) {
      this.loadUser(null);
    }
  }

  get isUsersTab() {
    return this.activeTab === "users";
  }

  // ---- Users tab ----

  async loadUser(userId) {
    this.isLoadingUser = true;
    this.userError = undefined;
    try {
      this.user = await getUser({ userId });
    } catch (error) {
      this.userError = reduceErrors(error);
    } finally {
      this.isLoadingUser = false;
    }
  }

  handleUserSearch(event) {
    this.userSearch = event.target.value;
    this.debouncedUserSearch();
  }

  async runUserSearch() {
    try {
      this.userResults = await searchUsers({ searchTerm: this.userSearch });
    } catch (error) {
      this.userResults = [];
      this.userError = reduceErrors(error);
    }
  }

  get userResultRows() {
    return this.userResults.map((u) => ({
      ...u,
      detail: `${u.username}${u.isActive ? "" : " · inactive"}`
    }));
  }

  get hasUserResults() {
    return this.userResults.length > 0;
  }

  handleUserPick(event) {
    this.userResults = [];
    this.userSearch = "";
    this.loadUser(event.currentTarget.dataset.id);
  }

  get userLinks() {
    const u = this.user;
    if (!u) {
      return {};
    }
    const id = encodeURIComponent(u.id);
    return {
      details: `/lightning/setup/ManageUsers/page?address=%2F${id}%3Fnoredirect%3D1%26isUserEntityOverride%3D1`,
      showAllData: showAllDataUrl(u.id),
      profile: `/lightning/setup/EnhancedProfiles/page?address=%2F${u.profileId}`,
      permissionSets: `/lightning/setup/PermSets/page?address=%2Fudd%2FPermissionSet%2FassignPermissionSet.apexp%3FuserId%3D${id}`,
      permissionSetGroups: `/lightning/setup/PermSetGroups/page?address=%2Fudd%2FPermissionSetGroup%2FassignPermissionSet.apexp%3FuserId%3D${id}%26isPermsetGroup%3D1`,
      loginAs: `/servlet/servlet.su?oid=${encodeURIComponent(u.orgId)}&suorgadminid=${id}&retURL=%2F&targetURL=%2F`
    };
  }

  get userLanguage() {
    return this.user ? `${this.user.language} | ${this.user.locale}` : "";
  }

  get canLoginAs() {
    return this.user && !this.user.isCurrentUser && this.user.isActive;
  }

  get debugModeLabel() {
    return this.user?.debugMode ? "Disable Debug Mode" : "Enable Debug Mode";
  }

  async handleToggleDebugMode() {
    const enabled = !this.user.debugMode;
    this.isSavingUser = true;
    try {
      this.user = await setDebugMode({ userId: this.user.id, enabled });
      this.toast(
        `Debug mode ${enabled ? "enabled" : "disabled"}`,
        this.user.name,
        "success"
      );
    } catch (error) {
      this.toast("Debug mode update failed", reduceErrors(error), "error");
    } finally {
      this.isSavingUser = false;
    }
  }

  @wire(CurrentPageReference)
  handlePageReference(pageReference) {
    const attributes = pageReference?.attributes || {};
    const recordId = attributes.recordId || pageReference?.state?.c__recordId;
    const objectApiName = attributes.objectApiName;
    if (recordId === this.recordId && objectApiName === this.objectApiName) {
      return;
    }
    this.recordId = recordId;
    this.objectApiName = objectApiName;
    this.loadContext();
  }

  async loadContext() {
    this.record = undefined;
    this.objectInfo = undefined;
    this.contextError = undefined;
    if (!this.recordId && !this.objectApiName) {
      return;
    }
    this.isLoadingContext = true;
    try {
      if (this.recordId) {
        this.record = await getRecord({ recordId: this.recordId });
        this.objectApiName = this.record.objectApiName;
      } else {
        this.objectInfo = await getObjectInfo({
          objectApiName: this.objectApiName
        });
      }
    } catch (error) {
      this.contextError = reduceErrors(error);
    } finally {
      this.isLoadingContext = false;
    }
  }

  // ---- Context getters ----

  get hasRecord() {
    return !!this.record;
  }

  get hasObjectOnly() {
    return !this.record && !!this.objectInfo;
  }

  get hasNoContext() {
    return !this.record && !this.objectInfo && !this.isLoadingContext;
  }

  get objectLabel() {
    return this.record?.objectLabel || this.objectInfo?.label;
  }

  get recordTitle() {
    return this.record?.recordName || this.record?.recordId;
  }

  get setupLinks() {
    const objectApiName = this.objectApiName;
    return [
      ...OBJECT_SETUP_PAGES.map((p) => ({
        key: p.page,
        label: p.label,
        url: objectSetupUrl(objectApiName, p.page)
      })),
      { key: "list", label: "List", url: `/lightning/o/${objectApiName}/list` }
    ];
  }

  get summaryRows() {
    if (!this.record) {
      return [];
    }
    const byName = new Map(this.record.fields.map((f) => [f.name, f]));
    return SUMMARY_FIELDS.filter(
      (name) => byName.has(name) && byName.get(name).value
    ).map((name) => {
      const field = byName.get(name);
      return {
        name,
        label: field.label,
        value: field.value,
        url: field.type === "REFERENCE" ? showAllDataUrl(field.value) : null
      };
    });
  }

  get fieldRows() {
    if (!this.record) {
      return [];
    }
    return this.record.fields
      .filter(
        (f) =>
          !this.fieldFilter ||
          containsIgnoreCase(f.label, this.fieldFilter) ||
          containsIgnoreCase(f.name, this.fieldFilter) ||
          containsIgnoreCase(f.value, this.fieldFilter)
      )
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // ---- Search getters ----

  get searchRows() {
    return this.searchResults.map((r) => ({
      ...r,
      markedName: highlight(r.name, this.searchTerm)
    }));
  }

  get hasSearchResults() {
    return this.searchResults.length > 0;
  }

  get hasNoSearchResults() {
    return (
      !this.isSearching && !this.searchError && this.searchResults.length === 0
    );
  }

  get searchPlaceholder() {
    const type = this.searchTypes.find((t) => t.value === this.searchType);
    return `Search ${type ? type.label : ""}`;
  }

  // ---- Handlers ----

  handleFieldFilter(event) {
    this.fieldFilter = event.target.value;
  }

  handleIdInput(event) {
    this.idInput = event.target.value;
  }

  handleIdKeyUp(event) {
    if (event.key === "Enter") {
      this.handleOpenId();
    }
  }

  handleOpenId() {
    const id = (this.idInput || "").trim();
    if (!isSalesforceId(id)) {
      this.toast("Invalid record Id", id, "error");
      return;
    }
    window.open(showAllDataUrl(id), "_blank");
  }

  async handleCopy(event) {
    const value = event.currentTarget.dataset.value;
    const copied = await copyToClipboard(value);
    this.toast(
      copied ? "Copied to clipboard" : "Copy failed",
      value,
      copied ? "success" : "error"
    );
  }

  handleSearchType(event) {
    this.searchType = event.detail.value;
    this.runSearch();
  }

  handleSearchTerm(event) {
    this.searchTerm = event.target.value;
    this.debouncedSearch();
  }

  async runSearch() {
    this.isSearching = true;
    this.searchError = undefined;
    try {
      this.searchResults = await search({
        metadataType: this.searchType,
        searchTerm: this.searchTerm
      });
    } catch (error) {
      this.searchResults = [];
      this.searchError = reduceErrors(error);
    } finally {
      this.isSearching = false;
    }
  }

  toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
