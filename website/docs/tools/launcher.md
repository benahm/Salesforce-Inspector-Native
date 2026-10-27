---
title: Launcher
sidebar_position: 1
---

The launcher opens from the **SF Inspector** action of the global actions menu (`+`), on any Lightning page. It shows
as a panel docked at the bottom of the window.

On a record page, it starts on that record: the Objects tab inspects it, and Data Export and Data Import open
pre-filled for its object. Elsewhere, paste a record Id, an Id prefix (`001`) or an object name.

## Objects

The [object inspector](./object-inspector.md): fields, relationships and edition of the current record, or of any
object or record you search.

## Search

Pick a type, then type a name: results come as you type, up to 25, and open their Setup page in a new tab.

| Type                                           | Listed                                                                  |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| Objects                                        | Objects the user can access and query.                                  |
| Apex Classes, Apex Triggers, Visualforce Pages | Those without a namespace (code of the org, not of installed packages). |
| Flows                                          | Flows of the org.                                                       |

## Users

Starts on the current user. Search other users by name, username, email or alias (2 characters at least, up to 20
results).

- **Details:** name, username, Id (copy, or open in Show All Data), email, profile, role, language and locale.
- **Links to Setup:** user details, permission set assignments, permission set group assignments, debug logs.
- **Enable / Disable Debug Mode** for the user, directly.
- **Login As** another active user.

## Tools

| Group      | Tools                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- |
| Data       | [Data Export](./data-export.md), [Data Import](./data-import.md)                                    |
| Monitoring | [Logs Viewer](./logs-viewer.md), [Event Monitor](./event-monitor.md), [Org Limits](./org-limits.md) |

Each tool opens in a new browser tab.
