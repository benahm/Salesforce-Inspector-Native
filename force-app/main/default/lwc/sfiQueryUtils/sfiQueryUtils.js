/**
 * Pure helpers for Data Export: SOQL context detection, result flattening and exports.
 */

const CLAUSES = [
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET"
];
const CLAUSE_PATTERN =
  /\b(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET)\b/gi;

/**
 * Replaces every parenthesized block (subqueries, functions) with spaces, keeping offsets.
 */
export function maskParentheses(text) {
  let depth = 0;
  let result = "";
  for (const char of text) {
    if (char === "(") {
      depth++;
      result += " ";
    } else if (char === ")") {
      depth = Math.max(0, depth - 1);
      result += " ";
    } else {
      result += depth > 0 ? " " : char;
    }
  }
  return result;
}

/**
 * Main object of a query: the first FROM outside parentheses.
 */
export function getFromObject(soql) {
  const match = /\bFROM\s+([\w]+)/i.exec(maskParentheses(soql || ""));
  return match ? match[1] : null;
}

/**
 * Describes what the user is typing at the cursor position.
 * Returns { clause, token, path, prefix } where token is the word being typed,
 * path the relationship names before the last dot and prefix the part after it.
 */
export function getCursorContext(soql, cursor) {
  const before = (soql || "").slice(0, cursor);
  const token = (/[\w.]*$/.exec(before) || [""])[0];
  const masked = maskParentheses(before);
  let clause = null;
  let match;
  CLAUSE_PATTERN.lastIndex = 0;
  while ((match = CLAUSE_PATTERN.exec(masked)) !== null) {
    // Ignore the keyword currently being typed.
    if (match.index + match[0].length <= masked.length - token.length) {
      clause = match[1].toUpperCase().replace(/\s+/, " ");
    }
  }
  const parts = token.split(".");
  return {
    clause: CLAUSES.includes(clause) ? clause : null,
    token,
    path: parts.slice(0, -1),
    prefix: parts[parts.length - 1]
  };
}

/**
 * Inserts a suggestion in place of the token ending at the cursor.
 */
export function applySuggestion(soql, cursor, token, value) {
  const start = cursor - token.length;
  const text = soql.slice(0, start) + value + soql.slice(cursor);
  return { text, cursor: start + value.length };
}

/**
 * Top-level SELECT items, lowercased, used to order result columns like the query.
 */
export function getSelectedFields(soql) {
  const masked = maskParentheses(soql || "");
  const select = /\bSELECT\b/i.exec(masked);
  const from = /\bFROM\b/i.exec(masked);
  if (!select || !from || from.index < select.index) {
    return [];
  }
  const list = soql.slice(select.index + 6, from.index);
  const items = [];
  let depth = 0;
  let current = "";
  for (const char of list) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      items.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  items.push(current);
  return items
    .map((item) => item.trim())
    .filter((item) => item)
    .map((item) => {
      // "COUNT(Id) total" -> alias "total"; "Account.Name" -> "account.name"
      const alias = /\)\s+(\w+)$/.exec(item);
      return (alias ? alias[1] : item).toLowerCase();
    });
}

/**
 * Flattens a record returned by JSON.serialize(List<SObject>) into { "Account.Name": value }.
 */
export function flattenRecord(record, prefix = "", out = {}) {
  Object.keys(record).forEach((key) => {
    if (key === "attributes") {
      return;
    }
    const value = record[key];
    const column = prefix + key;
    if (value && typeof value === "object") {
      if (Array.isArray(value.records)) {
        out[column] = `[${value.totalSize ?? value.records.length} records]`;
      } else if (value.attributes) {
        flattenRecord(value, column + ".", out);
      } else {
        out[column] = JSON.stringify(value);
      }
    } else {
      out[column] = value;
    }
  });
  return out;
}

/**
 * Builds { columns, rows } from serialized records, columns ordered like the SELECT list.
 */
export function toTable(records, soql) {
  const rows = records.map((record) => flattenRecord(record));
  const columns = [];
  const seen = new Set();
  rows.forEach((row) => {
    Object.keys(row).forEach((column) => {
      if (!seen.has(column)) {
        seen.add(column);
        columns.push(column);
      }
    });
  });
  const order = getSelectedFields(soql);
  // Position of each selected column; a subquery is keyed by its relationship name.
  const positions = new Map();
  order.forEach((item, index) => {
    const subquery = /^\(select\b.*\bfrom\s+(\w+)/.exec(item);
    positions.set(subquery ? subquery[1] : item, index);
  });
  const rank = (column) => positions.get(column.toLowerCase()) ?? order.length;
  // Apex also serializes fields it fetched implicitly (OwnerId for Owner.Name...):
  // keep only what the user selected, unless the SELECT list cannot be matched.
  const keepAll = order.some((item) => /^(fields|typeof)\b/.test(item));
  const isSelected = (column) =>
    keepAll || positions.has(column.toLowerCase()) || /^expr\d+$/i.test(column);
  const indexed = columns
    .filter((column) => isSelected(column))
    .map((column, index) => ({ column, index }));
  indexed.sort((a, b) => rank(a.column) - rank(b.column) || a.index - b.index);
  return { columns: indexed.map((c) => c.column), rows };
}

function csvCell(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns, rows) {
  const lines = [columns.map(csvCell).join(",")];
  rows.forEach((row) =>
    lines.push(columns.map((c) => csvCell(row[c])).join(","))
  );
  return lines.join("\r\n");
}

/**
 * Tab separated values, pasted as cells in Excel.
 */
export function toTsv(columns, rows) {
  const cell = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    return String(value).replace(/[\t\r\n]+/g, " ");
  };
  const lines = [columns.join("\t")];
  rows.forEach((row) =>
    lines.push(columns.map((c) => cell(row[c])).join("\t"))
  );
  return lines.join("\r\n");
}

export function toJson(rows) {
  return JSON.stringify(rows, null, 2);
}
