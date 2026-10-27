/**
 * Shared helpers for SF Inspector Native components.
 */

import NAMESPACE_MARKER_URL from "@salesforce/resourceUrl/sfiNamespace";

export const VERSION = "0.1.0";

const ID_PATTERN = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

export function isSalesforceId(value) {
  return ID_PATTERN.test((value || "").trim());
}

// Component URLs carry the namespace: "c" when deployed unpackaged, "sfinative"
// once installed from the package, where the resource URL ends with "sfinative__sfiNamespace".
const namespace =
  /\/(\w+?)__sfiNamespace/.exec(NAMESPACE_MARKER_URL)?.[1] || "c";

function componentUrl(name, params = {}) {
  const query = Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `c__${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `/lightning/cmp/${namespace}__${name}${query ? "?" + query : ""}`;
}

export function showAllDataUrl(recordId) {
  return componentUrl("sfiShowAllData", { recordId });
}

export function dataExportUrl(query) {
  return componentUrl("sfiDataExport", { query });
}

export function dataImportUrl(objectApiName) {
  return componentUrl("sfiDataImport", { object: objectApiName });
}

export function orgLimitsUrl() {
  return componentUrl("sfiOrgLimits");
}

export function eventMonitorUrl() {
  return componentUrl("sfiEventMonitor");
}

export function logsViewerUrl() {
  return componentUrl("sfiLogsViewer");
}

// Setup > Debug Logs: trace flags (enable logs) and "Delete All"
export const DEBUG_LOGS_SETUP_URL = "/lightning/setup/ApexDebugLogs/home";

// The log body is not queryable with SOQL: it opens in the Setup log viewer.
export function logDetailUrl(logId) {
  const address = `/p/setup/layout/ApexDebugLogDetailEdit/d?apex_log_id=${logId}`;
  return `/lightning/setup/ApexDebugLogs/page?address=${encodeURIComponent(address)}`;
}

export function recordUrl(recordId) {
  return `/lightning/r/${encodeURIComponent(recordId)}/view`;
}

export function objectSetupUrl(objectApiName, page = "Details") {
  return `/lightning/setup/ObjectManager/${encodeURIComponent(objectApiName)}/${page}/view`;
}

export const OBJECT_SETUP_PAGES = [
  { label: "Details", page: "Details" },
  { label: "Fields", page: "FieldsAndRelationships" },
  { label: "Layouts", page: "PageLayouts" },
  { label: "Lightning Pages", page: "LightningPages" },
  { label: "Record Types", page: "RecordTypes" },
  { label: "Validation Rules", page: "ValidationRules" },
  { label: "Triggers", page: "ApexTriggers" },
  { label: "Actions", page: "ButtonsLinksActions" }
];

/**
 * Tools listed in the launcher Tools tab. A tool without key is not built yet
 * and shows as "Soon": give it a key (and a url in the launcher) when it ships.
 * Developer tools of Inspector Reloaded that need the Tooling or Metadata API
 * (Field Creator, Download Metadata, REST Explorer...) are left to the CLI and
 * AI agents: SF Inspector Native stays 100% native, without callouts.
 */
export const TOOL_SECTIONS = [
  {
    title: "Data",
    tools: [
      { label: "Data Export", key: "dataExport" },
      { label: "Data Import", key: "dataImport" }
    ]
  },
  {
    title: "Monitoring",
    tools: [
      { label: "Logs Viewer", key: "logsViewer" },
      { label: "Event Monitor", key: "eventMonitor" },
      { label: "Org Limits", key: "orgLimits" }
    ]
  }
];

export function escapeRegExp(value) {
  return (value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeHtml(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Returns HTML-safe text with every occurrence of the term wrapped in <mark>.
 */
export function highlight(text, term) {
  const safeText = escapeHtml(text);
  const safeTerm = escapeHtml((term || "").trim());
  if (!safeTerm) {
    return safeText;
  }
  return safeText.replace(
    new RegExp(escapeRegExp(safeTerm), "gi"),
    "<mark>$&</mark>"
  );
}

export function containsIgnoreCase(haystack, needle) {
  return (haystack || "").toLowerCase().includes((needle || "").toLowerCase());
}

/**
 * A datatable only reports the selected rows it shows: keeps the ones it hides
 * (filtered out, or from a previous search) selected.
 */
export function mergeSelection(selectedIds, shownIds, shownSelectedIds) {
  const shown = new Set(shownIds);
  return [...selectedIds.filter((id) => !shown.has(id)), ...shownSelectedIds];
}

/**
 * Usernames or emails pasted one per line, or separated by commas, semicolons or
 * spaces (a column copied from a spreadsheet): lowercase, without duplicates.
 */
export function parseLogins(text) {
  return [
    ...new Set(
      (text || "")
        .split(/[\s,;]+/)
        .map((login) => login.trim().toLowerCase())
        .filter((login) => login)
    )
  ];
}

export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export async function copyToClipboard(text) {
  const value = text == null ? "" : String(text);
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  }
}

export function reduceErrors(error) {
  const errors = Array.isArray(error) ? error : [error];
  return errors
    .filter((e) => !!e)
    .map((e) => {
      if (Array.isArray(e.body)) {
        return e.body.map((b) => b.message).join(", ");
      }
      if (e.body?.message) {
        return e.body.message;
      }
      if (e.body?.output?.errors?.length) {
        return e.body.output.errors.map((b) => b.message).join(", ");
      }
      return e.message || String(e);
    })
    .join(", ");
}
