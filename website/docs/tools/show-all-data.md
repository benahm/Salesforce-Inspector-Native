---
title: Show All Data
sidebar_position: 2
---

Every field of a record, with its label, API name, type and value. It opens in a window from the launcher, from the
object inspector and from the users tab, or in its own browser tab from the other tools. It can also be placed on a
record page with the Lightning App Builder.

## Fields

| Column   | Content                                                  |
| -------- | -------------------------------------------------------- |
| Label    | Field label, with its help text as a tooltip.            |
| API Name | Custom fields are highlighted.                           |
| Type     | Field type, `formula`, or the object a lookup points to. |
| Value    | Lookups link to the record they point to.                |

Filter on label, API name or value, and hide empty values. Datetimes are shown in GMT (ISO format), binary fields as
`(binary)`, address and location fields as JSON.

In the window, following a lookup opens the record in place, and **Back** returns to the previous one. **Open in tab**
moves to a full browser tab.

## Related

The child relationships of the record: relationship name, child object and field. **Count** counts the related
records, **Export** opens [Data Export](./data-export.md) with the matching query, and **Related list** opens the
standard related list.

## Header

- An Id field and **Show**, to open another record.
- **Refresh**, **Edit** (when the object is updateable), **Open record** and **Object Manager**.

**Edit** shows the updateable fields in a form, and saves only the fields you changed.

Only the fields the user can read are shown.
