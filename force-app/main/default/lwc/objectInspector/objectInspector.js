import { LightningElement, api } from "lwc";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getRecord from "@salesforce/apex/SFI_RecordService.getRecord";
import countChildren from "@salesforce/apex/SFI_RecordService.countChildren";
import getObjectInfo from "@salesforce/apex/SFI_DescribeService.getObjectInfo";
import getFields from "@salesforce/apex/SFI_DescribeService.getFields";
import listObjects from "@salesforce/apex/SFI_DescribeService.listObjects";
import ShowAllDataModal from "c/showAllDataModal";
import {
  containsIgnoreCase,
  copyToClipboard,
  dataExportUrl,
  isSalesforceId,
  recordUrl,
  reduceErrors
} from "c/utils";

const MAX_OBJECT_MATCHES = 8;

/**
 * Objects tab of the launcher: inspects the record or object of the page, or any
 * record / object found with the search box. Lookups can be followed in place,
 * with a back button.
 */
export default class ObjectInspector extends LightningElement {
  // Inspected target: { recordId } or { objectApiName }
  target;
  history = [];
  record;
  objectInfo;
  objectFields = [];
  error;
  isLoading = false;

  // Search
  searchInput = "";
  objects;

  // Explorer
  view = "fields";
  filter = "";
  hideEmpty = true;
  showLabels = false;
  counts = {};
  isEditing = false;
  changedFields = new Set();
  isSaving = false;

  _pageRecordId;
  _pageObjectApiName;

  @api
  get pageRecordId() {
    return this._pageRecordId;
  }
  set pageRecordId(value) {
    this._pageRecordId = value;
    this.resetToPage();
  }

  @api
  get pageObjectApiName() {
    return this._pageObjectApiName;
  }
  set pageObjectApiName(value) {
    this._pageObjectApiName = value;
    this.resetToPage();
  }

  resetToPage() {
    const target = this._pageRecordId
      ? { recordId: this._pageRecordId }
      : this._pageObjectApiName
        ? { objectApiName: this._pageObjectApiName }
        : null;
    if (
      this.sameTarget(target, this.history[0] || this.target) &&
      this.target
    ) {
      return;
    }
    this.history = [];
    this.inspect(target, false);
  }

  sameTarget(a, b) {
    return (
      (a?.recordId || null) === (b?.recordId || null) &&
      (a?.objectApiName || null) === (b?.objectApiName || null)
    );
  }

  inspect(target, pushHistory = true) {
    if (pushHistory && this.target) {
      this.history = [...this.history, this.target];
    }
    this.target = target;
    this.load();
  }

  async load() {
    this.record = undefined;
    this.objectInfo = undefined;
    this.objectFields = [];
    this.error = undefined;
    this.counts = {};
    this.isEditing = false;
    this.changedFields = new Set();
    this.filter = "";
    this.view = "fields";
    if (!this.target) {
      return;
    }
    this.isLoading = true;
    try {
      if (this.target.recordId) {
        this.record = await getRecord({ recordId: this.target.recordId });
      } else {
        const objectApiName = this.target.objectApiName;
        const [info, fields] = await Promise.all([
          getObjectInfo({ objectApiName }),
          getFields({ objectApiName })
        ]);
        this.objectInfo = info;
        this.objectFields = fields;
      }
    } catch (error) {
      this.error = reduceErrors(error);
    } finally {
      this.isLoading = false;
    }
  }

  handleBack() {
    const history = [...this.history];
    const previous = history.pop();
    this.history = history;
    this.target = previous;
    this.load();
  }

  get canGoBack() {
    return this.history.length > 0;
  }

  // ---- Search: record Id, key prefix or object name ----

  async ensureObjects() {
    if (!this.objects) {
      try {
        this.objects = await listObjects();
      } catch (error) {
        this.objects = [];
        this.error = reduceErrors(error);
      }
    }
    return this.objects;
  }

  handleSearchInput(event) {
    this.searchInput = event.target.value;
    if (this.searchInput.trim().length >= 2) {
      this.ensureObjects();
    }
  }

  handleSearchKeyUp(event) {
    if (event.key === "Enter") {
      this.resolveSearch();
    }
  }

  async resolveSearch() {
    const term = (this.searchInput || "").trim();
    if (!term) {
      return;
    }
    if (isSalesforceId(term)) {
      this.searchInput = "";
      this.inspect({ recordId: term });
      return;
    }
    const objects = await this.ensureObjects();
    const byPrefix = objects.find(
      (o) => o.keyPrefix && o.keyPrefix.toLowerCase() === term.toLowerCase()
    );
    const match = byPrefix || this.objectMatches[0];
    if (match) {
      this.searchInput = "";
      this.inspect({ objectApiName: match.name });
    } else {
      this.toast("Nothing found", term, "warning");
    }
  }

  get objectMatches() {
    const term = (this.searchInput || "").trim();
    if (!this.objects || term.length < 2 || isSalesforceId(term)) {
      return [];
    }
    const lower = term.toLowerCase();
    return this.objects
      .filter(
        (o) =>
          containsIgnoreCase(o.name, term) ||
          containsIgnoreCase(o.label, term) ||
          (o.keyPrefix && o.keyPrefix.toLowerCase() === lower)
      )
      .sort((a, b) => {
        // Exact key prefix first, then names starting with the term.
        const rank = (o) => {
          if (o.keyPrefix?.toLowerCase() === lower) return 0;
          return o.name.toLowerCase().startsWith(lower) ? 1 : 2;
        };
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      })
      .slice(0, MAX_OBJECT_MATCHES);
  }

  get hasObjectMatches() {
    return this.objectMatches.length > 0;
  }

  handleObjectPick(event) {
    this.searchInput = "";
    this.inspect({ objectApiName: event.currentTarget.dataset.name });
  }

  // ---- Card ----

  get hasRecord() {
    return !!this.record;
  }

  get hasObjectOnly() {
    return !this.record && !!this.objectInfo;
  }

  get hasNothing() {
    return !this.target && !this.isLoading;
  }

  get objectApiName() {
    return this.record?.objectApiName || this.objectInfo?.name;
  }

  get objectLabel() {
    return this.record?.objectLabel || this.objectInfo?.label;
  }

  get canCreate() {
    return this.record ? this.record.createable : !!this.objectInfo;
  }

  get newRecordUrl() {
    return `/lightning/o/${this.objectApiName}/new`;
  }

  handleShowAllData() {
    ShowAllDataModal.show(this.record.recordId);
  }

  get recordViewUrl() {
    return recordUrl(this.record?.recordId);
  }

  handleInspectId(event) {
    event.preventDefault();
    // Lookup links sit in copyable cells: do not copy when following them.
    event.stopPropagation();
    const id = event.currentTarget.dataset.id;
    if (isSalesforceId(id)) {
      this.inspect({ recordId: id });
    }
  }

  // ---- Explorer ----

  get isFieldsView() {
    return this.view === "fields";
  }

  get isRelatedView() {
    return this.view === "related";
  }

  get fieldsSegmentClass() {
    return `slds-button sfi-segment ${this.isFieldsView ? "slds-button_brand" : "slds-button_neutral"}`;
  }

  get relatedSegmentClass() {
    return `slds-button sfi-segment ${this.isRelatedView ? "slds-button_brand" : "slds-button_neutral"}`;
  }

  get relatedCount() {
    return this.record ? this.record.childRelationships.length : 0;
  }

  handleShowFields() {
    this.view = "fields";
  }

  handleShowRelated() {
    this.view = "related";
    this.isEditing = false;
  }

  handleFilter(event) {
    this.filter = event.target.value;
  }

  handleToggleHideEmpty() {
    this.hideEmpty = !this.hideEmpty;
  }

  handleToggleLabels() {
    this.showLabels = !this.showLabels;
  }

  get labelToggleTitle() {
    return this.showLabels ? "Show API names" : "Show labels";
  }

  get labelToggleIcon() {
    return this.showLabels ? "utility:text" : "utility:type";
  }

  matchesFilter(...values) {
    return (
      !this.filter || values.some((v) => containsIgnoreCase(v, this.filter))
    );
  }

  get fieldRows() {
    if (!this.record) {
      return [];
    }
    return this.record.fields
      .filter(
        (f) =>
          !this.hideEmpty ||
          (f.value !== null && f.value !== undefined && f.value !== "")
      )
      .filter((f) => this.matchesFilter(f.label, f.name, f.value))
      .map((f) => ({
        ...f,
        display: this.showLabels ? f.label : f.name,
        tooltip: this.showLabels ? f.name : f.label,
        isLookup: f.type === "REFERENCE" && isSalesforceId(f.value || "")
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get fieldCountLabel() {
    const total = this.record ? this.record.fields.length : 0;
    return `${this.fieldRows.length} / ${total}`;
  }

  get relationshipRows() {
    if (!this.record) {
      return [];
    }
    const recordId = this.record.recordId;
    return this.record.childRelationships
      .filter((rel) =>
        this.matchesFilter(
          rel.relationshipName,
          rel.childObject,
          rel.childObjectLabel
        )
      )
      .map((rel) => {
        const key = `${rel.childObject}.${rel.field}`;
        return {
          ...rel,
          key,
          count: this.counts[key],
          hasCount: this.counts[key] !== undefined,
          display: this.showLabels
            ? rel.childObjectLabel
            : rel.relationshipName,
          tooltip: this.showLabels
            ? `${rel.relationshipName} (${rel.childObject}.${rel.field})`
            : `${rel.childObjectLabel} (${rel.childObject}.${rel.field})`,
          exportUrl: dataExportUrl(
            `SELECT Id FROM ${rel.childObject} WHERE ${rel.field} = '${recordId}'`
          ),
          relatedListUrl: `/lightning/r/${this.record.objectApiName}/${recordId}/related/${rel.relationshipName}/view`
        };
      })
      .sort((a, b) => a.relationshipName.localeCompare(b.relationshipName));
  }

  async handleCount(event) {
    const { child, field } = event.currentTarget.dataset;
    try {
      const count = await countChildren({
        recordId: this.record.recordId,
        childObject: child,
        field
      });
      this.counts = { ...this.counts, [`${child}.${field}`]: count };
    } catch (error) {
      this.toast("Count failed", reduceErrors(error), "error");
    }
  }

  // Object-only view: field metadata of the object.
  get metadataRows() {
    return this.objectFields
      .filter((f) => this.matchesFilter(f.name, f.label, f.type))
      .map((f) => ({
        ...f,
        display: this.showLabels ? f.label : f.name,
        tooltip: this.showLabels ? f.name : f.label,
        typeLabel:
          f.type.toLowerCase() +
          (f.referenceTo && f.referenceTo.length
            ? ` (${f.referenceTo.join(", ")})`
            : "")
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get metadataCountLabel() {
    return `${this.metadataRows.length} / ${this.objectFields.length} fields`;
  }

  // ---- Edit in place (only modified fields are saved) ----

  get canEdit() {
    return this.record?.updateable && this.isFieldsView;
  }

  get editRows() {
    return this.record.fields
      .filter((f) => f.updateable)
      .filter((f) => this.matchesFilter(f.label, f.name, f.value))
      .map((f) => ({
        ...f,
        display: this.showLabels ? f.label : f.name,
        tooltip: this.showLabels ? f.name : f.label,
        changed: this.changedFields.has(f.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  handleEdit() {
    this.isEditing = true;
    this.changedFields = new Set();
  }

  handleCancelEdit() {
    this.isEditing = false;
    this.changedFields = new Set();
  }

  handleFieldChange(event) {
    const changed = new Set(this.changedFields);
    changed.add(event.target.dataset.name);
    this.changedFields = changed;
  }

  get changedCount() {
    return this.changedFields.size;
  }

  get saveDisabled() {
    return this.isSaving || this.changedFields.size === 0;
  }

  handleSubmit(event) {
    event.preventDefault();
    const allFields = event.detail.fields;
    const fields = {};
    this.changedFields.forEach((name) => {
      fields[name] = allFields[name];
    });
    this.isSaving = true;
    this.template.querySelector("lightning-record-edit-form").submit(fields);
  }

  handleSaveSuccess() {
    this.isSaving = false;
    this.toast(
      "Record saved",
      `${this.changedFields.size} field(s) updated`,
      "success"
    );
    this.load();
  }

  handleSaveError() {
    this.isSaving = false;
  }

  // ---- Misc ----

  async handleCopy(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) {
      return;
    }
    const copied = await copyToClipboard(value);
    this.toast(
      copied ? "Copied to clipboard" : "Copy failed",
      value,
      copied ? "success" : "error"
    );
  }

  toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
