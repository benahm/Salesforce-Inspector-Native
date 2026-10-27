/**
 * Pure helpers for Data Import: CSV parsing, column mapping, validation and reports.
 */

const DELIMITERS = [",", ";", "\t"];

/**
 * Picks the delimiter that appears most often in the first line, outside quotes.
 */
export function detectDelimiter(text) {
  let firstLine = "";
  let inQuotes = false;
  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes;
    if (!inQuotes && (char === "\n" || char === "\r")) break;
    firstLine += char;
  }
  const outsideQuotes = firstLine.replace(/"[^"]*"/g, "");
  let best = ",";
  let bestCount = 0;
  DELIMITERS.forEach((delimiter) => {
    const count = outsideQuotes.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  });
  return best;
}

/**
 * RFC 4180 parser: quoted fields, escaped quotes ("") and line breaks inside quotes.
 * Returns { header, rows, delimiter } with rows as arrays of strings.
 */
export function parseCsv(input, delimiter) {
  const text = (input || "").replace(/^\uFEFF/, "");
  const sep = delimiter || detectDelimiter(text);
  const records = [];
  let record = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }
  const nonEmpty = records.filter((r) =>
    r.some((value) => value.trim() !== "")
  );
  const [header = [], ...rows] = nonEmpty;
  return { header: header.map((h) => h.trim()), rows, delimiter: sep };
}

const normalize = (value) => (value || "").toLowerCase().replace(/[\s_]/g, "");

/**
 * Maps each CSV column to a field by API name, then by label (case and spaces ignored).
 * Returns an array aligned with the header: field API name or "" when unmapped.
 */
export function autoMap(header, fields) {
  const byName = new Map(fields.map((f) => [f.name.toLowerCase(), f.name]));
  const byLabel = new Map(fields.map((f) => [normalize(f.label), f.name]));
  const used = new Set();
  return header.map((column) => {
    const field =
      byName.get(column.toLowerCase()) || byLabel.get(normalize(column)) || "";
    if (!field || used.has(field)) {
      return "";
    }
    used.add(field);
    return field;
  });
}

/**
 * Fields a column can be mapped to for an operation.
 */
export function fieldsForOperation(fields, operation) {
  if (operation === "delete") {
    return fields.filter((f) => f.name === "Id");
  }
  return fields.filter((f) => {
    if (f.name === "Id") {
      return operation !== "insert";
    }
    if (operation === "insert") return f.createable;
    if (operation === "update") return f.updateable;
    return f.createable || f.updateable;
  });
}

/**
 * Blocking errors and warnings for the current setup.
 */
export function validateMapping({
  operation,
  mapping,
  fields,
  externalIdField,
  rowCount
}) {
  const errors = [];
  const warnings = [];
  const mapped = mapping.filter((m) => m);
  if (!rowCount) {
    errors.push("No data rows to import.");
  }
  if (!mapped.length) {
    errors.push("Map at least one column to a field.");
  }
  if (
    (operation === "update" || operation === "delete") &&
    !mapped.includes("Id")
  ) {
    errors.push(`An Id column is required for ${operation}.`);
  }
  if (operation === "upsert") {
    if (!externalIdField) {
      errors.push("Choose the external Id field used to match records.");
    } else if (!mapped.includes(externalIdField)) {
      errors.push(`Map a column to the external Id field ${externalIdField}.`);
    }
  }
  if (operation === "insert" || operation === "upsert") {
    const missing = fields
      .filter((f) => f.requiredOnCreate && !mapped.includes(f.name))
      .map((f) => f.name);
    if (missing.length) {
      warnings.push(
        `Required fields not mapped (new records may fail): ${missing.join(", ")}`
      );
    }
  }
  const ignored = mapping.filter((m) => !m).length;
  if (ignored && mapped.length) {
    warnings.push(`${ignored} column(s) will be ignored.`);
  }
  return { errors, warnings };
}

/**
 * Converts CSV rows into { field: value } objects using the mapping.
 */
export function toRecords(rows, mapping) {
  return rows.map((row) => {
    const record = {};
    mapping.forEach((field, index) => {
      if (field) {
        record[field] = row[index] === undefined ? "" : row[index];
      }
    });
    return record;
  });
}

function csvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Original columns followed by the import outcome of each row.
 */
export function resultsToCsv(header, rows, results, onlyErrors = false) {
  const lines = [
    [...header, "SFI_Status", "SFI_Id", "SFI_Error"].map(csvCell).join(",")
  ];
  rows.forEach((row, index) => {
    const result = results[index];
    if (onlyErrors && (!result || result.success)) {
      return;
    }
    let status = "Not processed";
    if (result && !result.success) {
      status = "Error";
    } else if (result) {
      status = result.validated
        ? "Valid"
        : result.created
          ? "Created"
          : "Success";
    }
    lines.push(
      [...header.map((_, i) => row[i]), status, result?.id, result?.error]
        .map(csvCell)
        .join(",")
    );
  });
  return lines.join("\r\n");
}
