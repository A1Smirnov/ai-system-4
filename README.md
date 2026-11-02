# AI-System

AI-System is a personal AI workflow system built on OpenClaw. Ten agent roles
use a shared SQLite task registry and role-scoped Model Context Protocol (MCP)
tools to coordinate research, prepare job applications, review mail and analyze
security reports.

It runs on Ubuntu with local state and separately configured model providers.
This repository is a sanitized source edition of a personal prototype. Real
workflow quality, complete runtime setup from a clean clone and independent
backup recovery remain open work.

## Main workflows

- **Task coordination:** bounded contracts, one responsible role, evidence
  references and explicit unknowns. OpenClaw handles providers and sessions;
  the application layer handles workflow state and approvals.
- **Career preparation:** Greenhouse, Lever and Ashby sources, requirements
  review, confirmed candidate facts and versioned application packages.
  External submission requires separate owner approval, with manual CAPTCHA handoff.
- **Mail review:** read-only Outlook integration with approved date windows,
  paginated header review and acknowledged coverage checkpoints.
- **Security reporting:** passive Ubuntu/OpenClaw observations and reviews of
  approved local website snapshots, without automatic remediation.
- **Local visibility:** a read-only career dashboard and a Personal Operations
  status page in the OpenClaw UI.

## Controlled agent learning

Owner feedback and task-result metadata feed versioned memory and improvement
proposals. Each candidate records its sources and content hash. Memory checks
preserve the owner's wording and scope; a fixed evaluator tests declarative
career-policy proposals against a synthetic baseline and holdout cases.

Passing checks makes a candidate ready for owner review. Approval is bound to
the exact SHA-256 version; application and withdrawal are separate actions.
Identical proposals reuse the existing candidate; rollback refuses to overwrite
later edits. This loop does not train model weights or apply arbitrary code
changes. Synthetic success does not establish better live results.

## Security boundaries

- Fixed MCP tool sets and runtime input validation enforce role-specific access
  before dispatch. Audit events record role, tool and outcome without payloads.
- The coordinator receives minimal metadata about other roles' tasks;
  private task narratives remain with their assigned role.
- Career approvals bind exact package digests, source/profile versions and
  expiry. Durable uncertain attempts block automatic replay.
- Mail review is read-only. Security agents analyze saved reports; report
  freshness and collection failures remain visible.

These are application controls, not OS-level isolation or a guarantee against
prompt injection. External content is data and cannot grant new authority.

## Reproduce the local checks

Use the Node version in `.node-version` and npm compatible with the lockfiles.
From a fresh clone:

```bash
npm ci --ignore-scripts --no-audit --no-fund
node scripts/prepare-config.cjs "$PWD"
npm run check
```

The configuration command creates **disabled examples** and refuses existing
files; run it once in a fresh clone. Checks use synthetic data and temporary
SQLite databases. Strict TypeScript checking currently covers four JavaScript
modules. The CI workflow defines the same development checks.

These commands install development tools only. OpenClaw, Outlook, model access,
agent workspaces and browser setup are separate. See [setup](docs/SETUP.md)
before attempting runtime installation.

## Source map

OpenClaw owns the Gateway, providers and native sessions. The CommonJS application
layer owns task contracts, workflow state, evidence and approval records.

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

Read [architecture and roles](docs/ARCHITECTURE.md),
[source layout](docs/STRUCTURE.md), [limitations](docs/LIMITATIONS.md) and
[language conventions](docs/LOCALIZATION.md).

The project began on Windows under the historical name `AI.exe -y` and migrated
to Ubuntu. Current validation covers Ubuntu; see [Windows and WSL2](docs/WINDOWS.md)
and [native porting guidance](docs/WINDOWS_PORT_PROMPT.md) for compatibility limits.

## Privacy and license

This edition excludes credentials, databases, conversations, candidate materials,
job records, browser profiles, private workspaces, working permissions and the
original Git history. A source snapshot does not replace a private-state backup.
See [privacy](docs/PRIVACY.md) for the distribution boundary.

No license has been selected for the custom code. Dependency provenance and
upstream notices are retained in [third-party notices](THIRD_PARTY_NOTICES.md).
