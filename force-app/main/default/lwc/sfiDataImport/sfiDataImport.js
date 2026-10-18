import { LightningElement, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import LightningConfirm from "lightning/confirm";
import LightningPrompt from "lightning/prompt";
import listObjects from "@salesforce/apex/SFI_DescribeService.listObjects";
import getImportFields from "@salesforce/apex/SFI_ImportService.getImportFields";
import importBatch from "@salesforce/apex/SFI_ImportService.importBatch";
import {
  containsIgnoreCase,
  dataExportUrl,
  isSalesforceId,
  reduceErrors,
  showAllDataUrl
} from "c/sfiUtils";
import {
  autoMap,
  fieldsForOperation,
  parseCsv,
  resultsToCsv,
  toRecords,
  validateMapping
} from "c/sfiImportUtils";

const MAX_ROWS = 50000;
const MAX_DISPLAY_ROWS = 1000;
const IGNORE = "";

export default class SfiDataImport extends LightningElement {
  // Data
  rawData = "";
  fileName;
  header = [];
  rows = [];
  delimiter;

  // Action
  operation = "insert";
  objectApiName;
  objectSearch = "";
  objects = [];
  fields = [];
  externalIdField;
  batchSize = "200";
  clearEmptyValues = false;
  mapping = [];

  // Execution
  isRunning = false;
  stopRequested = false;
  validateOnly = false;
  processed = 0;
  results;
  resultFilter = "all";
  error;

  operationOptions = [
    { label: "Insert", value: "insert" },
    { label: "Update", value: "update" },
    { label: "Upsert", value: "upsert" },
    { label: "Delete", value: "delete" }
  ];

  batchSizeOptions = [
    { label: "Batch of 50", value: "50" },
    { label: "Batch of 200", value: "200" },
    { label: "Batch of 1000", value: "1000" }
  ];

  resultFilterOptions = [
    { label: "All", value: "all" },
    { label: "Errors", value: "errors" },
    { label: "Success", value: "success" }
  ];

  @wire(CurrentPageReference)
  handlePageReference(pageReference) {
    const state = pageReference?.state || {};
    if (
      state.c__operation &&
      this.operationOptions.some((o) => o.value === state.c__operation)
    ) {
      this.operation = state.c__operation;
    }
    if (state.c__object && state.c__object !== this.objectApiName) {
      this.selectObject(state.c__object);
    }
  }

  async connectedCallback() {
    try {
      this.objects = await listObjects();
    } catch (error) {
      this.error = reduceErrors(error);
    }
  }

  get dataExportUrl() {
    return dataExportUrl(
      this.objectApiName
        ? `SELECT Id FROM ${this.objectApiName} LIMIT 100`
        : null
    );
  }

  // ---- Step 1: data ----

  handleDataInput(event) {
    this.rawData = event.target.value;
    this.fileName = undefined;
    this.parseData();
  }

  handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.rawData = reader.result;
      this.fileName = file.name;
      this.parseData();
    };
    reader.onerror = () => {
      this.error = `Cannot read ${file.name}`;
    };
    reader.readAsText(file);
  }

  handleClearData() {
    const editor = this.template.querySelector("textarea");
    if (editor) {
      editor.value = "";
    }
    this.rawData = "";
    this.fileName = undefined;
    this.parseData();
  }

  parseData() {
    const parsed = parseCsv(this.rawData);
    this.header = parsed.header;
    this.rows = parsed.rows;
    this.delimiter = parsed.delimiter;
    this.results = undefined;
    this.remap();
  }

  get hasData() {
    return this.header.length > 0;
  }

  get showPasteArea() {
    return !this.fileName;
  }

  get dataSummary() {
    if (!this.hasData) {
      return "Paste CSV or Excel cells (first line = column names), or choose a file.";
    }
    const names = { ",": "comma", ";": "semicolon", "\t": "tab" };
    const source = this.fileName ? `${this.fileName} · ` : "";
    return `${source}${this.rows.length} row(s) · ${this.header.length} column(s) · ${names[this.delimiter]} separated`;
  }

  // ---- Step 2: action and object ----

  handleOperation(event) {
    this.operation = event.detail.value;
    this.results = undefined;
    this.remap();
  }

  handleObjectSearch(event) {
    this.objectSearch = event.target.value;
  }

  get objectMatches() {
    const term = (this.objectSearch || "").trim();
    if (!term || term === this.objectApiName) {
      return [];
    }
    const lower = term.toLowerCase();
    return this.objects
      .filter(
        (o) =>
          containsIgnoreCase(o.name, term) || containsIgnoreCase(o.label, term)
      )
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(lower) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(lower) ? 0 : 1;
        return aStarts - bStarts || a.name.localeCompare(b.name);
      })
      .slice(0, 12);
  }

  get hasObjectMatches() {
    return this.objectMatches.length > 0;
  }

  handleObjectPick(event) {
    this.selectObject(event.currentTarget.dataset.name);
  }

  async selectObject(objectApiName) {
    this.objectApiName = objectApiName;
    this.objectSearch = objectApiName;
    this.externalIdField = undefined;
    this.results = undefined;
    this.error = undefined;
    try {
      this.fields = await getImportFields({ objectApiName });
      this.externalIdField = this.fields.some((f) => f.name === "Id")
        ? "Id"
        : undefined;
    } catch (error) {
      this.fields = [];
      this.error = reduceErrors(error);
    }
    this.remap();
  }

  get isUpsert() {
    return this.operation === "upsert";
  }

  get isDelete() {
    return this.operation === "delete";
  }

  get showClearEmpty() {
    return !this.isDelete;
  }

  get externalIdOptions() {
    return this.fields
      .filter((f) => f.externalId)
      .map((f) => ({ label: `${f.label} (${f.name})`, value: f.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  handleExternalId(event) {
    this.externalIdField = event.detail.value;
  }

  handleBatchSize(event) {
    this.batchSize = event.detail.value;
  }

  handleClearEmpty(event) {
    this.clearEmptyValues = event.target.checked;
  }

  // ---- Step 3: mapping ----

  get availableFields() {
    return fieldsForOperation(this.fields, this.operation);
  }

  remap() {
    this.mapping = this.fields.length
      ? autoMap(this.header, this.availableFields)
      : this.header.map(() => IGNORE);
  }

  get fieldOptions() {
    return [
      { label: "— Ignore column —", value: IGNORE },
      ...this.availableFields
        .map((f) => ({ label: `${f.name} (${f.label})`, value: f.name }))
        .sort((a, b) => a.label.localeCompare(b.label))
    ];
  }

  get showMapping() {
    return this.hasData && this.fields.length > 0;
  }

  get mappingRows() {
    const options = this.fieldOptions;
    return this.header.map((column, index) => ({
      index: String(index),
      column,
      sample: this.rows.length ? this.rows[0][index] : "",
      field: this.mapping[index] || IGNORE,
      options,
      rowClass: this.mapping[index] ? "" : "sfi-ignored"
    }));
  }

  handleMappingChange(event) {
    const index = Number(event.target.dataset.index);
    const mapping = [...this.mapping];
    const value = event.detail.value;
    // A field can only receive one column.
    if (value) {
      const previous = mapping.indexOf(value);
      if (previous !== -1) mapping[previous] = IGNORE;
    }
    mapping[index] = value;
    this.mapping = mapping;
  }

  get validation() {
    const result = validateMapping({
      operation: this.operation,
      mapping: this.mapping,
      fields: this.fields,
      externalIdField: this.externalIdField,
      rowCount: this.rows.length
    });
    if (!this.objectApiName) {
      result.errors.unshift("Choose an object.");
    }
    if (this.rows.length > MAX_ROWS) {
      result.errors.push(`An import is limited to ${MAX_ROWS} rows.`);
    }
    return result;
  }

  get validationErrors() {
    return this.hasData ? this.validation.errors : [];
  }

  get validationWarnings() {
    return this.hasData ? this.validation.warnings : [];
  }

  get hasValidationErrors() {
    return this.validationErrors.length > 0;
  }

  get hasValidationWarnings() {
    return this.validationWarnings.length > 0;
  }

  get runDisabled() {
    return this.isRunning || !this.hasData || this.validation.errors.length > 0;
  }

  get importLabel() {
    const verb = this.operationOptions.find(
      (o) => o.value === this.operation
    ).label;
    return `${verb} ${this.rows.length} row(s)`;
  }

  get importVariant() {
    return this.isDelete ? "destructive" : "brand";
  }

  // ---- Step 4: execution ----

  async handleValidate() {
    await this.run(true);
  }

  async handleImport() {
    const count = this.rows.length;
    const label = this.importLabel;
    if (this.isDelete) {
      const typed = await LightningPrompt.open({
        label: "Confirm deletion",
        message: `This deletes ${count} ${this.objectApiName} record(s). Type ${count} to confirm.`,
        theme: "error"
      });
      if (typed === null || typed === undefined) {
        return;
      }
      if (String(typed).trim() !== String(count)) {
        this.toast(
          "Deletion cancelled",
          "The number typed does not match.",
          "warning"
        );
        return;
      }
    } else {
      const confirmed = await LightningConfirm.open({
        label: "Confirm import",
        message: `${label} into ${this.objectApiName}? Each row is saved on its own: valid rows are committed even if others fail.`,
        theme: "warning"
      });
      if (!confirmed) {
        return;
      }
    }
    await this.run(false);
  }

  handleStop() {
    this.stopRequested = true;
  }

  async run(validateOnly) {
    const records = toRecords(this.rows, this.mapping);
    const total = records.length;
    const batchSize = Number(this.batchSize);
    const results = new Array(total);
    this.validateOnly = validateOnly;
    this.isRunning = true;
    this.stopRequested = false;
    this.processed = 0;
    this.results = results;
    this.resultFilter = "all";
    this.error = undefined;

    for (
      let start = 0;
      start < total && !this.stopRequested;
      start += batchSize
    ) {
      const batch = records.slice(start, start + batchSize);
      try {
        // eslint-disable-next-line no-await-in-loop
        const batchResults = await importBatch({
          objectApiName: this.objectApiName,
          operation: this.operation,
          externalIdField: this.isUpsert ? this.externalIdField : null,
          rows: batch,
          clearEmptyValues: this.clearEmptyValues,
          validateOnly,
          firstIndex: start
        });
        batchResults.forEach((r) => {
          // A dry run is rolled back: its Ids do not exist.
          results[r.index] = validateOnly
            ? { ...r, id: null, created: false, validated: true }
            : r;
        });
      } catch (error) {
        const message = reduceErrors(error);
        batch.forEach((_, i) => {
          results[start + i] = {
            index: start + i,
            success: false,
            error: message
          };
        });
      }
      this.processed = Math.min(start + batch.length, total);
      this.results = [...results];
    }

    this.isRunning = false;
    const { success, errors } = this.counts;
    const title = validateOnly
      ? "Validation finished (nothing saved)"
      : "Import finished";
    this.toast(
      title,
      `${success} succeeded, ${errors} failed`,
      errors ? "warning" : "success"
    );
  }

  // ---- Results ----

  get hasResults() {
    return !!this.results;
  }

  get progressValue() {
    return this.rows.length
      ? Math.round((this.processed / this.rows.length) * 100)
      : 0;
  }

  get progressLabel() {
    return `${this.processed} / ${this.rows.length}`;
  }

  get counts() {
    let success = 0;
    let errors = 0;
    (this.results || []).forEach((r) => {
      if (!r) return;
      if (r.success) success++;
      else errors++;
    });
    const notProcessed =
      (this.results ? this.results.length : 0) - success - errors;
    return { success, errors, notProcessed };
  }

  get resultsTitle() {
    return this.validateOnly
      ? "Validation results (dry run, nothing was saved)"
      : "Import results";
  }

  get resultSummary() {
    const { success, errors, notProcessed } = this.counts;
    let summary = `${success} succeeded · ${errors} failed`;
    if (notProcessed && !this.isRunning) {
      summary += ` · ${notProcessed} not processed (stopped)`;
    }
    return summary;
  }

  get previewColumns() {
    return this.header.slice(0, 3);
  }

  handleResultFilter(event) {
    this.resultFilter = event.detail.value;
  }

  get resultRows() {
    const rows = [];
    for (
      let i = 0;
      i < this.rows.length && rows.length < MAX_DISPLAY_ROWS;
      i++
    ) {
      const r = this.results[i];
      if (this.resultFilter === "errors" && (!r || r.success)) continue;
      if (this.resultFilter === "success" && (!r || !r.success)) continue;
      let status = "Pending";
      let statusClass = "slds-text-color_weak";
      if (r) {
        status = r.success ? this.successLabel(r) : "Error";
        statusClass = r.success
          ? "slds-text-color_success"
          : "slds-text-color_error";
      }
      const id =
        r && r.id && isSalesforceId(r.id) && !this.validateOnly ? r.id : null;
      rows.push({
        key: String(i),
        line: i + 2,
        status,
        statusClass,
        id: r ? r.id : "",
        idUrl: id ? showAllDataUrl(id) : null,
        error: r ? r.error : "",
        values: this.previewColumns.map((_, c) => ({
          key: String(c),
          value: this.rows[i][c]
        }))
      });
    }
    return rows;
  }

  successLabel(result) {
    if (result.validated) return "Valid";
    return result.created ? "Created" : "Success";
  }

  get maxDisplayRows() {
    return MAX_DISPLAY_ROWS;
  }

  get resultsTruncated() {
    return this.rows.length > MAX_DISPLAY_ROWS;
  }

  get downloadErrorsDisabled() {
    return this.isRunning || this.counts.errors === 0;
  }

  handleDownloadResults() {
    this.download(
      resultsToCsv(this.header, this.rows, this.results),
      "results"
    );
  }

  handleDownloadErrors() {
    this.download(
      resultsToCsv(this.header, this.rows, this.results, true),
      "errors"
    );
  }

  download(csv, suffix) {
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.href =
      "data:text/csv;charset=utf-8," + encodeURIComponent("\uFEFF" + csv);
    link.download = `${this.objectApiName}-${this.operation}-${suffix}-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
