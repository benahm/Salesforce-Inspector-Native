---
title: Object inspector
sidebar_position: 3
---

The Objects tab of the [launcher](./launcher.md). Type a record Id, an Id prefix (`001`) or an object name or label:
up to 8 matching objects are offered, and **Enter** opens the first one.

## On a record

- **Fields:** API names in alphabetical order, with a filter. Empty values are hidden by default, and labels can
  replace API names. Click a value to copy it.
- **Related:** each child relationship, with **Count**, **Export** (opens [Data Export](./data-export.md) with the
  records related to this one) and **List** (the standard related list).
- **Edit** (pencil): the updateable fields in a form. Only the fields you changed are saved.
- Clicking a lookup inspects that record in place. **Back** returns to the previous one.

The header gives the object label and API name, and the buttons **Show All Data**, **Open** (the record in a new tab)
and **New** (when the object is createable).

## On an object

Without a record, the inspector lists the fields of the object: name or label, type and the objects a lookup points
to, with a filter.
