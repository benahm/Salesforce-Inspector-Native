---
title: Org Limits
sidebar_position: 6
---

Every limit of the org (API requests, data and file storage, emails, platform events…), read with the Apex
`OrgLimits` class.

Each limit shows a bar with its consumption, `X of Y consumed`, and what is left: yellow from 70%, red from 90%.

- Filter by name, and sort by consumption or by name.
- **Refresh** reads the limits again.
- **Copy as JSON** copies them in the format of the REST `/limits` resource (`Max` and `Remaining`).
