---
title: Data Import
sidebar_position: 5
---

Insert, update, upsert or delete records from CSV or from cells copied from Excel.

## Data

Paste the data, or pick a `.csv`, `.txt` or `.tsv` file. The first line holds the column names. The separator (comma,
semicolon or tab) is detected, and quoted values are supported. Up to 50,000 rows.

## Options

| Option                      |                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Object                      | Searched by name.                                                                                       |
| Operation                   | **Insert**, **Update** and **Delete** (both need an `Id` column), **Upsert** (on an external Id field). |
| Batch size                  | 50, 200 or 1,000 rows per call.                                                                         |
| Empty cells clear the field | Off by default: empty cells leave the field as it is.                                                   |

## Mapping

Each column is mapped to a field by API name, then by label. Change a mapping, or set a column to **Ignore column**.
Blocking errors prevent the run. Warnings point out required fields not mapped and ignored columns.

Values are converted to the field type: `true`, `1`, `yes`, `y` or `x` for a checkbox, a decimal comma for numbers,
ISO or local dates.

## Run

- **Validate only (dry run)** saves the records and rolls them back: you see the real errors (validation rules,
  triggers, duplicates) and nothing is saved.
- **Import** asks for a confirmation. For a delete, you type the number of rows to confirm.
- Each row is saved on its own: valid rows are saved even when others fail. A progress bar shows the run, and **Stop**
  ends it after the current batch.

## Report

Each row gets a status (Created, Success, Valid, Error), its Id (linked to [Show All Data](./show-all-data.md)) and
its error. Filter by errors or successes, and download the results or the errors as CSV: your columns plus
`SFI_Status`, `SFI_Id` and `SFI_Error`, ready to fix and import again.
