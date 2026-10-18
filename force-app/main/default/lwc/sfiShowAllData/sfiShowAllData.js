import { LightningElement, api, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getRecord from "@salesforce/apex/SFI_RecordService.getRecord";
import countChildren from "@salesforce/apex/SFI_RecordService.countChildren";
import {
  containsIgnoreCase,
  copyToClipboard,
  isSalesforceId,
  objectSetupUrl,
  recordUrl,
  reduceErrors,
  showAllDataUrl
} from "c/sfiUtils";

export default class SfiShowAllData extends LightningElement {
  data;
  error;
  isLoading = false;
  isEditing = false;
  isSaving = false;
  filter = "";
  hideEmpty = false;
  idInput = "";
  changedFields = new Set();
  counts = {};
  loadedId;
  _recordId;

  @api
  get recordId() {
    return this._recordId;
  }
  set recordId(value) {
    this._recordId = value;
    if (value && value !== this.loadedId) {
      this.load(value);
    }
  }

  @wire(CurrentPageReference)
  handlePageReference(pageReference) {
    const stateId = pageReference?.state?.c__recordId;
    if (stateId && stateId !== this.loadedId) {
      this.load(stateId);
    }
  }

  async load(recordId) {
    this.loadedId = recordId;
    this.isLoading = true;
    this.error = undefined;
    this.isEditing = false;
    this.changedFields = new Set();
    this.counts = {};
    try {
      this.data = await getRecord({ recordId });
    } catch (error) {
      this.data = undefined;
      this.error = reduceErrors(error);
    } finally {
      this.isLoading = false;
    }
  }

  // ---- Getters ----

  get hasData() {
    return !!this.data;
  }

  get hasNoRecord() {
    return !this.data && !this.isLoading;
  }

  get title() {
    return this.data?.recordName || this.data?.recordId;
  }

  get recordUrl() {
    return recordUrl(this.data?.recordId);
  }

  get objectSetupUrl() {
    return objectSetupUrl(this.data?.objectApiName);
  }

  get canEdit() {
    return this.data?.updateable && !this.isEditing;
  }

  get fieldRows() {
    if (!this.data) {
      return [];
    }
    return this.data.fields
      .filter(
        (field) =>
          !this.hideEmpty || (field.value !== null && field.value !== undefined)
      )
      .filter(
        (field) =>
          !this.filter ||
          containsIgnoreCase(field.label, this.filter) ||
          containsIgnoreCase(field.name, this.filter) ||
          containsIgnoreCase(field.value, this.filter)
      )
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((field) => ({
        ...field,
        typeLabel: this.typeLabel(field),
        isReference: field.type === "REFERENCE" && !!field.value,
        referenceUrl: field.value ? showAllDataUrl(field.value) : null,
        rowClass: field.custom ? "sfi-custom" : ""
      }));
  }

  get editableRows() {
    return this.fieldRows
      .filter((field) => field.updateable)
      .map((field) => ({
        ...field,
        changed: this.changedFields.has(field.name)
      }));
  }

  get fieldCountLabel() {
    const total = this.data ? this.data.fields.length : 0;
    return `${this.fieldRows.length} / ${total} fields`;
  }

  get relationshipRows() {
    if (!this.data) {
      return [];
    }
    return this.data.childRelationships
      .filter(
        (rel) =>
          !this.filter ||
          containsIgnoreCase(rel.relationshipName, this.filter) ||
          containsIgnoreCase(rel.childObject, this.filter) ||
          containsIgnoreCase(rel.childObjectLabel, this.filter)
      )
      .map((rel) => {
        const key = `${rel.childObject}.${rel.field}`;
        return {
          ...rel,
          key,
          count: this.counts[key],
          hasCount: this.counts[key] !== undefined,
          relatedListUrl: `/lightning/r/${this.data.objectApiName}/${this.data.recordId}/related/${rel.relationshipName}/view`
        };
      });
  }

  get relationshipTabLabel() {
    return `Related (${this.data ? this.data.childRelationships.length : 0})`;
  }

  get fieldsTabLabel() {
    return `Fields (${this.data ? this.data.fields.length : 0})`;
  }

  get changedCount() {
    return this.changedFields.size;
  }

  get saveDisabled() {
    return this.isSaving || this.changedFields.size === 0;
  }

  typeLabel(field) {
    const type = field.type.toLowerCase();
    if (field.type === "REFERENCE" && field.referenceTo) {
      return `${type} (${field.referenceTo})`;
    }
    return field.calculated ? `${type} (formula)` : type;
  }

  // ---- Handlers ----

  handleIdInput(event) {
    this.idInput = event.target.value;
  }

  handleIdKeyUp(event) {
    if (event.key === "Enter") {
      this.handleShow();
    }
  }

  handleShow() {
    const id = (this.idInput || "").trim();
    if (!isSalesforceId(id)) {
      this.error = `Invalid record Id: ${id}`;
      return;
    }
    this.load(id);
  }

  handleFilter(event) {
    this.filter = event.target.value;
  }

  handleHideEmpty(event) {
    this.hideEmpty = event.target.checked;
  }

  handleRefresh() {
    this.load(this.loadedId);
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

  async handleCount(event) {
    const { child, field } = event.currentTarget.dataset;
    try {
      const count = await countChildren({
        recordId: this.data.recordId,
        childObject: child,
        field
      });
      this.counts = { ...this.counts, [`${child}.${field}`]: count };
    } catch (error) {
      this.toast("Count failed", reduceErrors(error), "error");
    }
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

  // Submit only the fields the user actually modified.
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
    this.load(this.loadedId);
  }

  handleSaveError() {
    this.isSaving = false;
  }

  toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
