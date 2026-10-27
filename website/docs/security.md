---
title: Security and permissions
---

## What the package does not do

- **No callout.** Nothing leaves the org: no remote site, no named credential, no connected app.
- **No Tooling API.** Everything goes through Apex controllers called by Lightning components.
- **No stored data.** The package has no custom object. Data Export history and saved queries stay in the browser
  (localStorage).

## What applies

- **User mode.** Queries and changes run with `AccessLevel.USER_MODE` in `with sharing` classes: users only see and
  change what their profile, permission sets and sharing allow.
- **Two permission sets** give access to the Apex classes of the package:
  - **SF Inspector Native User**: the launcher and every tool.
  - **SF Inspector Native Admin**: also the [Setup tab](./setup.mdx) (global action and access management).
- **System permissions stay on the profile.** The permission sets don't grant View Setup, Modify All Data or Manage
  Users. Reading other users' debug logs, listing Apex classes or changing another user's debug mode depends on the
  permissions the user already has.

## Metadata changes

The only metadata the package changes is its own global action on the global publisher layout, added or removed from
the Setup tab by an admin with Customize Application, through the Apex Metadata API (`Metadata.Operations`).
