---
title: Logs Viewer
sidebar_position: 8
---

The latest 500 debug logs of the org, newest first.

| Column                 |                                        |
| ---------------------- | -------------------------------------- |
| Start time, User       | When and for whom the log was written. |
| Operation, Request     | What ran: Apex, API, Visualforce, etc. |
| Status, Size, Duration | Result, size in KB and duration in ms. |
| View                   | Opens the log.                         |

Sort by any column, filter, show **only my logs**, and **Refresh**.

The body of a log can't be read without the Tooling API: **View** opens it in the standard Setup viewer, in a new tab.
The link to Setup > Debug Logs gives trace flags and **Delete All**.

The logs listed are those the user may see: other users' logs need the View All Data or Manage Users permission.
