# Disabled configuration examples

These are new-installation examples, not copies of working policies or owner
permissions. They contain no accounts, tokens, resumes, jobs, mail or outbound
grants. Model labels illustrate the schema; availability and routing require
local verification. Schedules, campaigns and learning are disabled; backup stays
paused. City coordinates are illustrative, not an owner location.

```bash
node scripts/prepare-config.cjs /absolute/path/to/new-installation
```

The command creates missing configuration and refuses to replace existing files
or traverse unsafe destination symlinks. Do not run it over a live installation.

The examples reproduce local development tests. Real operation additionally
requires local OpenClaw/Codex setup, agent workspaces, authentication, approved
sources and confirmed candidate facts. The example Gateway token is deliberately
invalid. Git source alone does not restore the personal system.
