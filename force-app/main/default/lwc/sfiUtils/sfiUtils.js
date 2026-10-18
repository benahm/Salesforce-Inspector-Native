/**
 * Shared helpers for SF Inspector Native components.
 */

export const VERSION = "0.1.0";

const ID_PATTERN = /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/;

export function isSalesforceId(value) {
  return ID_PATTERN.test((value || "").trim());
}

export function showAllDataUrl(recordId) {
  return `/lightning/cmp/c__sfiShowAllData?c__recordId=${encodeURIComponent(recordId)}`;
}

export function dataExportUrl(query) {
  return query
    ? `/lightning/cmp/c__sfiDataExport?c__query=${encodeURIComponent(query)}`
    : "/lightning/cmp/c__sfiDataExport";
}

export function dataImportUrl(objectApiName) {
  return objectApiName
    ? `/lightning/cmp/c__sfiDataImport?c__object=${encodeURIComponent(objectApiName)}`
    : "/lightning/cmp/c__sfiDataImport";
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
 * Tools listed in the launcher "+" tab. A tool without key is not built yet and
 * shows as "Soon": give it a key (and a url in the launcher) when it ships.
 */
export const TOOL_SECTIONS = [
  {
    title: "Data & Metadata",
    tools: [
      { label: "Data Export", key: "dataExport" },
      { label: "Data Import", key: "dataImport" },
      { label: "Logs Viewer" },
      { label: "Field Creator" },
      { label: "Download Metadata" },
      { label: "Dependencies Explorer" }
    ]
  },
  {
    title: "Platform Tools",
    tools: [
      { label: "REST Explorer" },
      { label: "Event Monitor" },
      { label: "Org Limits" },
      { label: "API Statistics" }
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
