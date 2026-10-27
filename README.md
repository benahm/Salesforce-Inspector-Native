# SF Inspector Native

> **Beta.** Install it in a sandbox, a Developer Edition or a scratch org, and please
> [report issues](https://github.com/benahm/Salesforce-Inspector-Native/issues).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="website/static/img/logo-beta-dark.svg">
    <img src="website/static/img/logo-beta.svg" alt="SF Inspector Native" width="120">
  </picture>
</p>

**Documentation: [benahm.github.io/Salesforce-Inspector-Native](https://benahm.github.io/Salesforce-Inspector-Native/)**

The essentials of [Salesforce Inspector](https://github.com/tprouvot/Salesforce-Inspector-reloaded), **built in
Salesforce**: a managed package of Lightning components and Apex, opened from a global action on every Lightning page.

No browser extension to install or allow: it works where extensions are blocked, on any browser, and an admin chooses
who gets it.

## Tools

| Tool             | What it does                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Launcher         | Opens from the global actions menu (`+`): inspect the current record, search metadata, look up users, reach every tool. |
| Show All Data    | Every field of a record, with its API name and type, and its related records.                                           |
| Object inspector | Find an object or a record by Id, prefix or name, browse its fields and relationships, edit it.                         |
| Data Export      | SOQL editor with autocomplete, results table, copy for Excel, CSV or JSON, CSV download.                                |
| Data Import      | Insert, update, upsert or delete from CSV or Excel cells, with a dry run and a per-row report.                          |
| Org Limits       | Every org limit, with its consumption.                                                                                  |
| Event Monitor    | Subscribe to platform events and change data capture events.                                                            |
| Logs Viewer      | The latest debug logs of the org.                                                                                       |
| Setup tab        | Add the global action in one click and choose who gets access.                                                          |

**100% native:** no callout, no Tooling API, no connected app. Queries and changes run in user mode, with the sharing,
object and field permissions of the user.

## Install

Take the package version Id (`04t…`) from the latest [release](https://github.com/benahm/Salesforce-Inspector-Native/releases), then:

```bash
sf package install --package <04t id> --target-org <alias> --wait 10
sf org assign permset --name sfinative__SFI_Inspector_Admin --target-org <alias>
```

Open the **SF Inspector Setup** tab, **Add** the global action, and give access to other users from the same tab. See
[Getting started](https://benahm.github.io/Salesforce-Inspector-Native/docs/getting-started).

## Development

```bash
npm install
sf org create scratch --definition-file config/project-scratch-def.json --alias sfi-dev
sf project deploy start --target-org sfi-dev
npm test
```

See [Development](https://benahm.github.io/Salesforce-Inspector-Native/docs/development) for tests, packaging and the
documentation site (`website`, built with Docusaurus).

## License

[MIT](LICENSE). Not affiliated with Salesforce.
