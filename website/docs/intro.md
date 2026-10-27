---
title: What is SF Inspector Native?
sidebar_label: Introduction
slug: /
---

SF Inspector Native brings the essentials of [Salesforce Inspector](https://github.com/tprouvot/Salesforce-Inspector-reloaded)
**inside Salesforce**: a managed package of Lightning components and Apex, opened from a global action on every
Lightning page.

No browser extension to install or allow: it works where extensions are blocked, on any browser, and an admin decides
who gets it.

## What is inside

| Tool                                            | What it does                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Launcher](./tools/launcher.md)                 | Opens from the global actions menu (`+`): inspect the current record, search metadata, look up users, reach every tool. |
| [Show All Data](./tools/show-all-data.md)       | Every field of a record, with its API name and type, and its related records.                                           |
| [Object inspector](./tools/object-inspector.md) | Find an object or a record by Id, prefix or name, browse its fields and relationships, edit it.                         |
| [Data Export](./tools/data-export.md)           | SOQL editor with autocomplete, results table, copy for Excel, CSV or JSON, CSV download.                                |
| [Data Import](./tools/data-import.md)           | Insert, update, upsert or delete from CSV or Excel cells, with a dry run and a per-row report.                          |
| [Org Limits](./tools/org-limits.md)             | Every org limit, with its consumption.                                                                                  |
| [Event Monitor](./tools/event-monitor.md)       | Subscribe to platform events and change data capture events.                                                            |
| [Logs Viewer](./tools/logs-viewer.md)           | The latest debug logs of the org.                                                                                       |
| [Setup tab](./setup.mdx)                        | Add the global action in one click and choose who gets access.                                                          |

## Principles

- **100% native.** No callout, no Tooling API, no connected app. Tools that would need them are left out.
- **The org security applies.** Queries and changes run in user mode, with the sharing, object and field permissions
  of the user.
- **Access is given, not assumed.** Users need one of the two permission sets of the package: see
  [Security and permissions](./security.md).

Next: [Getting started](./getting-started.mdx).
