---
title: Data Export
sidebar_position: 4
---

A SOQL editor with autocomplete and a results table. Opened from a record page, it starts with
`SELECT Id FROM <Object> LIMIT 100`.

## Query

- **Ctrl+Enter** runs the query, **Tab** accepts the first suggestion.
- **Autocomplete:** objects after `FROM`, fields and relationships in `SELECT`, `WHERE`, `GROUP BY`, `ORDER BY` and
  `HAVING`. It follows relationship paths, such as `Owner.Profile.`.
- **Max rows:** 200, 2,000 (default) or 10,000.
- **Include deleted** adds `ALL ROWS`, for records in the recycle bin.
- **History** keeps the last 50 queries. **Saved queries** are named. Both stay in your browser.

Only `SELECT` queries are run. `SELECT COUNT()` returns the count, and aggregate queries are supported. When a large
result would use too much memory, it stops early and says more rows are available.

## Results

- Filter, sort by clicking a column, double-click a cell to copy it.
- Ids link to [Show All Data](./show-all-data.md). Subqueries show as `[N records]`.
- The table shows the first 1,000 rows. Copies and downloads include every row that matches the filter.

| Export       | Format                                       |
| ------------ | -------------------------------------------- |
| Copy (Excel) | Tab-separated, to paste into a spreadsheet.  |
| Copy (CSV)   | Comma-separated.                             |
| Copy (JSON)  | Records as JSON.                             |
| Download CSV | UTF-8 file named `<Object>-<timestamp>.csv`. |

The link next to the object opens [Data Import](./data-import.md) for it.
