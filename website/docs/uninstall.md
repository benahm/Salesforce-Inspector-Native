---
title: Uninstall
---

Salesforce refuses to uninstall a package while its components are in use. Before uninstalling SF Inspector Native:

1. In the **SF Inspector Setup** tab, **Remove** the global action, and wait for the status **Not added**.
2. In the Access section, select every user and **Remove access**. Do your own access last: it hides the tab.
3. Uninstall the package in Setup > Installed Packages, or with the CLI:

   ```bash
   sf package uninstall --package <04t id> --target-org <alias> --wait 10
   ```

If you have already lost access to the tab, remove the global action in Setup > Publisher Layouts, and the permission
set assignments in Setup > Permission Sets > Manage Assignments.
