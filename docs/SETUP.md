# Setup and verification

## Development

Follow the three commands in the root README. `npm run check` runs strict checks
on four JavaScript modules and the local test suite. The ten-vacancy benchmark
uses fictional data and mocked ATS responses, not real employers or model calls.

`node scripts/verify-clean-source.cjs /tmp/ai-clean-source-report.json --online`
also checks a separate temporary copy once this directory is a Git checkout.
It downloads pinned public development packages. Without `--online` it requires
an existing npm cache and fails if the packages are missing.

## Runtime installation is a separate operation

`app/package.json` / `app/package-lock.json` pin OpenClaw; Outlook has a separate
manifest and lock. The local npm tarball is required by the OpenClaw override;
keep `app/vendor/` at its recorded location. Its provenance file records the
archive hash and dependency patches. Runtime dependency install/lifecycle scripts
need their own review; the development CI does not install or test these runtimes.

Before starting services, configure these locally:

1. A loopback Gateway with a newly generated secret. The example token deliberately
   fails the startup preflight; never commit its replacement.
2. Native agent workspaces, provider/model configuration, authentication and
   the fixed MCP registration for each role. Example model names are historical
   configuration labels, not a guarantee of provider availability.
3. Approved sources, candidate facts/materials, local site scope and Outlook
   identity with the least permissions needed. Empty examples grant no access.
4. Appropriate host execution policy and OS restrictions. Do not weaken them just
   to make a diagnostic pass. MCP role checks are not an OS sandbox.

`npm run diagnose` performs local configuration checks. It does not verify a model
account or the full workflow. Do not install systemd units or run startup scripts
until the local setup and remaining Windows dependencies have been reviewed.
The supplied installer writes user units/launchers but does not enable boot login
autostart. Launchers use ports 18789 and 18795 by default.

Full private-state recovery, operational bootstrap from a clone, live browser
submission and all ten real agent sessions are outside the source-only checks.
