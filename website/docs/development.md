---
title: Development
---

SF Inspector Native is a Salesforce DX project: Lightning Web Components and Apex in `force-app`, packaged as the 2GP
managed package **SFI Native**, namespace `sfinative`.

## Requirements

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) and Node.js 20 or later.
- A Dev Hub linked to the `sfinative` namespace, to create scratch orgs with the namespace and package versions.

```bash
npm install
```

## Work in a scratch org

```bash
sf org create scratch --definition-file config/project-scratch-def.json --alias sfi-dev --duration-days 30
sf project deploy start --target-org sfi-dev
sf org assign permset --name SFI_Inspector_Admin --target-org sfi-dev
sf org open --target-org sfi-dev
```

Then add the global action from the **SF Inspector Setup** tab. In a scratch org with the namespace, the components
are named `sfinative__…`.

## Tests

```bash
npm run lint
npm test                                             # Jest tests of the Lightning components
sf apex run test --target-org sfi-dev --wait 10      # Apex tests
```

A pre-commit hook runs Prettier, ESLint and the related Jest tests.

## Package a version

```bash
sf package version create --package "SFI Native" --installation-key-bypass --code-coverage --wait 60
```

The new version Id (`04t…`) is added to `packageAliases` in `sfdx-project.json`. Test it in a scratch org without the
namespace before publishing a release.

## Documentation

This site is in `website`, built with [Docusaurus](https://docusaurus.io/):

```bash
cd website
bun install
bun run start
```

It is deployed to GitHub Pages when `website` changes on `main`.
