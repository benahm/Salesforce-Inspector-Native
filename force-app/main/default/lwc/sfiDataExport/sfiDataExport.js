import { LightningElement, wire } from "lwc";
import { CurrentPageReference } from "lightning/navigation";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import LightningPrompt from "lightning/prompt";
import runQuery from "@salesforce/apex/SFI_QueryService.runQuery";
import listObjects from "@salesforce/apex/SFI_DescribeService.listObjects";
import getFields from "@salesforce/apex/SFI_DescribeService.getFields";
import {
  containsIgnoreCase,
  copyToClipboard,
  dataImportUrl,
  isSalesforceId,
  reduceErrors,
  showAllDataUrl
} from "c/sfiUtils";
import {
  applySuggestion,
  getCursorContext,
  getFromObject,
  toCsv,
  toJson,
  toTable,
  toTsv
} from "c/sfiQueryUtils";

const HISTORY_KEY = "sfi.dataExport.history";
const SAVED_KEY = "sfi.dataExport.saved";
const MAX_HISTORY = 50;
const MAX_SUGGESTIONS = 60;
const MAX_DISPLAY_ROWS = 1000;
const FIELD_CLAUSES = ["SELECT", "WHERE", "GROUP BY", "ORDER BY", "HAVING"];
const DEFAULT_QUERY =
  "SELECT Id, Name FROM Account ORDER BY CreatedDate DESC LIMIT 10";

function readStorage(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage is a convenience only.
  }
}

export default class SfiDataExport extends LightningElement {
  query = "";
  cursor = 0;
  pendingCursor;
  maxRows = "2000";
  includeDeleted = false;
  isRunning = false;
  error;
  result;
  resultFilter = "";
  sortColumn;
  sortAsc = true;
  suggestions = [];
  suggestionContext;
  history = readStorage(HISTORY_KEY);
  saved = readStorage(SAVED_KEY);
  selectedSaved;
  objects = [];
  fieldsCache = new Map();
  suggestionRequest = 0;
  initialized = false;

  maxRowOptions = [
    { label: "200 rows", value: "200" },
    { label: "2,000 rows", value: "2000" },
    { label: "10,000 rows", value: "10000" }
  ];

  @wire(CurrentPageReference)
  handlePageReference(pageReference) {
    const stateQuery = pageReference?.state?.c__query;
    if (stateQuery) {
      this.setQuery(stateQuery);
    } else if (!this.initialized) {
      this.setQuery(this.history.length ? this.history[0] : DEFAULT_QUERY);
    }
    this.initialized = true;
  }

  async connectedCallback() {
    try {
      this.objects = await listObjects();
    } catch (error) {
      this.error = reduceErrors(error);
    }
  }

  renderedCallback() {
    this.syncEditor();
    const editor = this.template.querySelector("textarea");
    if (this.pendingCursor !== undefined) {
      editor.focus();
      editor.setSelectionRange(this.pendingCursor, this.pendingCursor);
      this.cursor = this.pendingCursor;
      this.pendingCursor = undefined;
    }
  }

  // ---- Editor and autocomplete ----

  // The query is not bound in the template (a native textarea ignores the value
  // attribute), so programmatic changes are pushed to the editor here.
  setQuery(value) {
    this.query = value;
    this.syncEditor();
  }

  syncEditor() {
    const editor = this.template.querySelector("textarea");
    if (editor && editor.value !== this.query) {
      editor.value = this.query;
    }
  }

  handleQueryInput(event) {
    this.query = event.target.value;
    this.cursor = event.target.selectionStart;
    this.updateSuggestions();
  }

  handleCursorMove(event) {
    if (event.target.selectionStart !== this.cursor) {
      this.cursor = event.target.selectionStart;
      this.updateSuggestions();
    }
  }

  handleKeyDown(event) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.handleRun();
    } else if (
      event.key === "Tab" &&
      this.suggestions.length &&
      !event.shiftKey
    ) {
      event.preventDefault();
      this.insertSuggestion(this.suggestions[0].value);
    }
  }

  handleSuggestionClick(event) {
    this.insertSuggestion(event.currentTarget.dataset.value);
  }

  insertSuggestion(value) {
    const context = this.suggestionContext;
    if (!context) {
      return;
    }
    const { text, cursor } = applySuggestion(
      this.query,
      this.cursor,
      context.prefix,
      value
    );
    this.setQuery(text);
    this.cursor = cursor;
    this.pendingCursor = cursor;
    this.updateSuggestions();
  }

  async updateSuggestions() {
    const request = ++this.suggestionRequest;
    const context = getCursorContext(this.query, this.cursor);
    let suggestions = [];
    try {
      if (context.clause === "FROM" && !context.path.length) {
        suggestions = this.objects
          .filter(
            (o) =>
              containsIgnoreCase(o.name, context.prefix) ||
              containsIgnoreCase(o.label, context.prefix)
          )
          .map((o) => ({ value: o.name, label: o.name, detail: o.label }));
      } else if (FIELD_CLAUSES.includes(context.clause)) {
        const objectName = await this.resolvePath(
          getFromObject(this.query),
          context.path
        );
        if (objectName) {
          const fields = await this.loadFields(objectName);
          fields.forEach((f) => {
            if (
              containsIgnoreCase(f.name, context.prefix) ||
              containsIgnoreCase(f.label, context.prefix)
            ) {
              suggestions.push({
                value: f.name,
                label: f.name,
                detail: `${f.label} (${f.type.toLowerCase()})`
              });
            }
            if (
              f.relationshipName &&
              containsIgnoreCase(f.relationshipName, context.prefix)
            ) {
              suggestions.push({
                value: f.relationshipName + ".",
                label: f.relationshipName + ".",
                detail: `${f.label} → ${f.referenceTo.join(", ")}`
              });
            }
          });
        }
      }
    } catch {
      suggestions = [];
    }
    if (request !== this.suggestionRequest) {
      return;
    }
    const prefix = context.prefix.toLowerCase();
    suggestions.sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(prefix) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(prefix) ? 0 : 1;
      return aStarts - bStarts || a.label.localeCompare(b.label);
    });
    this.suggestionContext = context;
    this.suggestions = suggestions.slice(0, MAX_SUGGESTIONS);
  }

  async loadFields(objectName) {
    const key = objectName.toLowerCase();
    if (!this.fieldsCache.has(key)) {
      this.fieldsCache.set(key, getFields({ objectApiName: objectName }));
    }
    try {
      return await this.fieldsCache.get(key);
    } catch (error) {
      this.fieldsCache.delete(key);
      throw error;
    }
  }

  // Follows relationship names (Owner.Profile) down to the target object.
  async resolvePath(objectName, path) {
    let current = objectName;
    for (const relationship of path) {
      if (!current) {
        return null;
      }
      // eslint-disable-next-line no-await-in-loop
      const fields = await this.loadFields(current);
      const field = fields.find(
        (f) =>
          f.relationshipName &&
          f.relationshipName.toLowerCase() === relationship.toLowerCase()
      );
      if (!field || !field.referenceTo.length) {
        return null;
      }
      current = field.referenceTo.includes("User")
        ? "User"
        : field.referenceTo[0];
    }
    return current;
  }

  get hasSuggestions() {
    return this.suggestions.length > 0;
  }

  // ---- Options, history and saved queries ----

  handleMaxRows(event) {
    this.maxRows = event.detail.value;
  }

  handleIncludeDeleted(event) {
    this.includeDeleted = event.target.checked;
  }

  get historyOptions() {
    return this.history.map((q) => ({
      label: q.length > 90 ? q.slice(0, 90) + "…" : q,
      value: q
    }));
  }

  get savedOptions() {
    return this.saved.map((s) => ({ label: s.name, value: s.name }));
  }

  get hasHistory() {
    return this.history.length > 0;
  }

  get hasSaved() {
    return this.saved.length > 0;
  }

  get deleteSavedDisabled() {
    return !this.selectedSaved;
  }

  handleHistorySelect(event) {
    this.setQuery(event.detail.value);
    this.suggestions = [];
  }

  handleSavedSelect(event) {
    this.selectedSaved = event.detail.value;
    const entry = this.saved.find((s) => s.name === this.selectedSaved);
    if (entry) {
      this.setQuery(entry.query);
      this.suggestions = [];
    }
  }

  async handleSave() {
    const name = await LightningPrompt.open({
      message: "Name of the saved query",
      label: "Save query",
      defaultValue: getFromObject(this.query) || ""
    });
    if (!name) {
      return;
    }
    this.saved = [
      { name, query: this.query },
      ...this.saved.filter((s) => s.name !== name)
    ];
    this.selectedSaved = name;
    writeStorage(SAVED_KEY, this.saved);
    this.toast("Query saved", name, "success");
  }

  handleDeleteSaved() {
    this.saved = this.saved.filter((s) => s.name !== this.selectedSaved);
    this.selectedSaved = undefined;
    writeStorage(SAVED_KEY, this.saved);
  }

  handleClearHistory() {
    this.history = [];
    writeStorage(HISTORY_KEY, this.history);
  }

  addToHistory(query) {
    this.history = [query, ...this.history.filter((q) => q !== query)].slice(
      0,
      MAX_HISTORY
    );
    writeStorage(HISTORY_KEY, this.history);
  }

  // ---- Execution ----

  async handleRun() {
    const query = (this.query || "").trim();
    if (!query || this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.error = undefined;
    this.suggestions = [];
    this.addToHistory(query);
    try {
      const soql = this.includeDeleted
        ? `${query.replace(/;\s*$/, "")} ALL ROWS`
        : query;
      const response = await runQuery({ soql, maxRows: Number(this.maxRows) });
      const table = toTable(JSON.parse(response.recordsJson), query);
      this.result = { ...response, ...table, objectName: getFromObject(query) };
      this.sortColumn = undefined;
      this.resultFilter = "";
    } catch (error) {
      this.result = undefined;
      this.error = reduceErrors(error);
    } finally {
      this.isRunning = false;
    }
  }

  get dataImportUrl() {
    return dataImportUrl(getFromObject(this.query));
  }

  // ---- Results ----

  get hasResult() {
    return !!this.result;
  }

  get isCountResult() {
    return (
      this.result &&
      this.result.count !== undefined &&
      this.result.count !== null
    );
  }

  get hasRows() {
    return this.result && this.result.rows.length > 0;
  }

  get filteredRows() {
    if (!this.result) {
      return [];
    }
    const { columns } = this.result;
    let rows = this.result.rows;
    if (this.resultFilter) {
      rows = rows.filter((row) =>
        columns.some((c) =>
          containsIgnoreCase(String(row[c] ?? ""), this.resultFilter)
        )
      );
    }
    if (this.sortColumn) {
      const column = this.sortColumn;
      const direction = this.sortAsc ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const x = a[column];
        const y = b[column];
        if (x === y) return 0;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        return (
          (typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x).localeCompare(String(y))) * direction
        );
      });
    }
    return rows;
  }

  get columnHeaders() {
    if (!this.result) {
      return [];
    }
    return this.result.columns.map((column) => ({
      name: column,
      sortIcon:
        this.sortColumn === column
          ? this.sortAsc
            ? "utility:arrowup"
            : "utility:arrowdown"
          : null
    }));
  }

  get displayRows() {
    const { columns } = this.result;
    return this.filteredRows.slice(0, MAX_DISPLAY_ROWS).map((row, index) => ({
      key: index,
      cells: columns.map((column) => {
        const value = row[column];
        const text = value === null || value === undefined ? "" : String(value);
        const isId =
          (column === "Id" || column.endsWith("Id")) && isSalesforceId(text);
        return {
          key: column,
          value: text,
          isId,
          url: isId ? showAllDataUrl(text) : null
        };
      })
    }));
  }

  get resultSummary() {
    const r = this.result;
    if (this.isCountResult) {
      return `COUNT() = ${r.count} · ${r.elapsedMs} ms`;
    }
    const filtered = this.filteredRows.length;
    let summary = `${r.size} row(s)`;
    if (this.resultFilter) {
      summary = `${filtered} of ${r.size} row(s)`;
    }
    if (r.hasMore) {
      summary += r.truncatedByHeap
        ? " · more rows available (stopped to protect memory)"
        : " · more rows available";
    }
    if (filtered > MAX_DISPLAY_ROWS) {
      summary += ` · first ${MAX_DISPLAY_ROWS} displayed, exports include all`;
    }
    return `${summary} · ${r.elapsedMs} ms`;
  }

  get exportDisabled() {
    return !this.hasRows;
  }

  handleResultFilter(event) {
    this.resultFilter = event.target.value;
  }

  handleSort(event) {
    const column = event.currentTarget.dataset.column;
    this.sortAsc = this.sortColumn === column ? !this.sortAsc : true;
    this.sortColumn = column;
  }

  async handleCopyCell(event) {
    const value = event.currentTarget.dataset.value;
    if (value) {
      await this.copy(value, "Value copied");
    }
  }

  handleCopyExcel() {
    this.copy(
      toTsv(this.result.columns, this.filteredRows),
      "Copied for Excel"
    );
  }

  handleCopyCsv() {
    this.copy(toCsv(this.result.columns, this.filteredRows), "Copied as CSV");
  }

  handleCopyJson() {
    this.copy(toJson(this.filteredRows), "Copied as JSON");
  }

  handleDownloadCsv() {
    const csv = "\uFEFF" + toCsv(this.result.columns, this.filteredRows);
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    link.download = `${this.result.objectName || "export"}-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async copy(text, title) {
    const copied = await copyToClipboard(text);
    this.toast(
      copied ? title : "Copy failed",
      undefined,
      copied ? "success" : "error"
    );
  }

  toast(title, message, variant) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
  }
}
