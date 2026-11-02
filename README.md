# AI-System · distilled source edition

An application layer for OpenClaw with ten agent roles, a SQLite task registry,
role-scoped MCP tools, a local dashboard and workflows for mail, job research,
security reports and reviewed improvements. The control code uses CommonJS
JavaScript; a small set of modules also passes strict TypeScript checking.

This is a sanitized source snapshot, not a backup of a configured installation.
It includes current application code and dependency locks. It contains no
accounts, conversations, candidate materials, job records or working permissions.
The existing Git history is intentionally absent.

## Platform history

The custom system was originally developed on Windows and later migrated to
Ubuntu. Current project validation covers Ubuntu. Upstream Windows support does
not establish a complete native Windows port of this application layer.
See [Windows setup and WSL2](docs/WINDOWS.md) and the
[LLM native Windows porting prompt](docs/WINDOWS_PORT_PROMPT.md).

## Reproduce the local checks

Use the Node version in `.node-version` and npm compatible with the lockfiles.
From a fresh clone:

```bash
npm ci --ignore-scripts --no-audit --no-fund
node scripts/prepare-config.cjs "$PWD"
npm run check
```

The configuration command creates **disabled examples** and refuses to overwrite
existing configuration. Run it once in a fresh clone. Tests use temporary SQLite
databases and fictional candidates; they do not send messages or applications.
The GitHub Actions workflow runs the same development checks.

These commands install development tools only. OpenClaw, Outlook, model access,
agent workspaces and browser setup are separate. See [setup](docs/SETUP.md).

## Source map

| Path | Purpose |
|---|---|
| `personal-system/control/` | Task registry, MCP role boundary, workflows and dashboard |
| `extensions/personal-operations/` | Status plugin, UI sources and current compiled resources |
| `scripts/` | Ubuntu launchers, diagnostics, configuration and verification |
| `scripts/systemd/` | Templates for manually started user services |
| `config-templates/` | Disabled, unconfigured JSON examples |
| `tests/` | Synthetic workflow and negative contract checks |
| `types/`, `tsconfig.json` | Incremental typing, not a full TypeScript conversion |
| `app/` | OpenClaw manifest, lockfile and documented local npm dependency patch |
| `integrations/outlook/` | Outlook MCP manifest and lockfile |
| `SOURCE-MANIFEST.json` | File sizes and SHA-256 hashes for this source snapshot |

Read [source layout](docs/STRUCTURE.md), [architecture](docs/ARCHITECTURE.md), [language conventions](docs/LOCALIZATION.md), [limitations](docs/LIMITATIONS.md),
[privacy](docs/PRIVACY.md) and [third-party notices](THIRD_PARTY_NOTICES.md).
No open-source license has been selected for the custom code.
