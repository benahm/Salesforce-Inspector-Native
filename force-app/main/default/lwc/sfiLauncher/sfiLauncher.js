import { LightningElement, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getRecord from "@salesforce/apex/SFI_RecordService.getRecord";
import getObjectInfo from "@salesforce/apex/SFI_DescribeService.getObjectInfo";
import search from "@salesforce/apex/SFI_SearchService.search";
import {
  containsIgnoreCase,
  copyToClipboard,
  debounce,
  highlight,
  isSalesforceId,
  OBJECT_SETUP_PAGES,
  objectSetupUrl,
  recordUrl,
  reduceErrors,
  SETUP_SHORTCUTS,
  showAllDataUrl,
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

  // Shortcuts tab
  shortcutFilter = "";

  activeTab = "context";
  availableHeight;

  constructor() {
    super();
    this.debouncedSearch = debounce(() => this.runSearch(), 300);
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
    const tabs = [{ value: "context", label: this.contextTabLabel }];
    if (this.record) {
      tabs.push({ value: "setup", label: "Setup" });
    }
    tabs.push(
      { value: "search", label: "Search" },
      { value: "shortcuts", label: "Shortcuts" }
    );
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

  get isSetupTab() {
    return this.activeTab === "setup";
  }

  get isSearchTab() {
    return this.activeTab === "search";
  }

  get isShortcutsTab() {
    return this.activeTab === "shortcuts";
  }

  get showObjectSetup() {
    return this.hasObjectOnly;
  }

  handleTab(event) {
    event.preventDefault();
    this.activeTab = event.currentTarget.dataset.tab;
    if (this.activeTab === "search" && !this.searchResults.length) {
      this.runSearch();
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
    if (this.activeTab === "setup") {
      this.activeTab = "context";
    }
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

  get contextTabLabel() {
    if (this.record) {
      return "Record";
    }
    return this.objectInfo ? "Object" : "Inspect";
  }

  get objectLabel() {
    return this.record?.objectLabel || this.objectInfo?.label;
  }

  get recordTitle() {
    return this.record?.recordName || this.record?.recordId;
  }

  get showAllDataUrl() {
    return showAllDataUrl(this.record?.recordId);
  }

  get recordViewUrl() {
    return recordUrl(this.record?.recordId);
  }

  get setupLinks() {
    const objectApiName = this.objectApiName;
    return OBJECT_SETUP_PAGES.map((p) => ({
      ...p,
      url: objectSetupUrl(objectApiName, p.page)
    }));
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

  // ---- Shortcuts getters ----

  get shortcutRows() {
    return SETUP_SHORTCUTS.filter(
      (s) =>
        !this.shortcutFilter ||
        containsIgnoreCase(s.label, this.shortcutFilter) ||
        containsIgnoreCase(s.section, this.shortcutFilter)
    );
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

  handleShortcutFilter(event) {
    this.shortcutFilter = event.target.value;
  }

  toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
