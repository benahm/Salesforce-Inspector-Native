---
title: Event Monitor
sidebar_position: 7
---

Subscribe to a streaming channel and watch its events arrive, with the Lightning `empApi`.

## Channel

| Type                    | Channels                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Custom Platform Event   | The `__e` events of the org.                                                                      |
| Standard Platform Event | The standard events.                                                                              |
| Change Event            | One object's change events, or **All Change Events** (`/data/ChangeEvents`).                      |
| Other channel           | Any channel typed by hand, such as `/event/LoginEventStream` or a custom channel `/event/X__chn`. |

**Replay from:** new events only, or every event still stored (up to 72 hours), after a confirmation.

## Events

The last 500 events, newest first. Change events show a summary: change type, object and record Ids. Filter them, copy
one, **Copy all** as JSON, or **Clear** the list.
