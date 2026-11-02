# Windows setup and portability

## Origin and current support

AI-System was originally developed on Windows, using PowerShell launch/stop
scripts, Task Scheduler and Windows process/resource inspection. It was later
migrated to Ubuntu. The maintained lifecycle now uses Bash, user systemd units
and Linux reporting. Existing Windows branches are not a complete supported port.

| Environment | Project evidence |
|---|---|
| Ubuntu | Recorded development checks and bounded runtime validation |
| Windows with WSL2 Ubuntu | Suggested compatibility route; this custom system is not yet validated end to end there |
| Native Windows | Original platform; current source needs a bounded port and Windows-specific acceptance |

Upstream OpenClaw supports native Windows CLI/Gateway and desktop options.
This does not automatically port the custom lifecycle or collectors. WSL2 is
the most Linux-compatible upstream Gateway route. See the
[official Windows guide](https://docs.openclaw.ai/platforms/windows).

## Route A: WSL2 Ubuntu

This is the lower-rewrite route for the current Linux-oriented custom code,
not a recorded success claim for this project on WSL.

1. Inspect Windows first from PowerShell:

   ```powershell
   wsl --version
   wsl --list --verbose
   ```

   If WSL is absent, follow [Microsoft installation instructions](https://learn.microsoft.com/en-us/windows/wsl/install).
   The standard setup command is `wsl --install`; host setup may require an
   elevated terminal and restart. Do not replace an existing distribution.

2. Open the selected Ubuntu distribution and check `systemctl --user status`.
   If systemd is unavailable, follow the [Microsoft systemd guide](https://learn.microsoft.com/en-us/windows/wsl/systemd),
   preserving existing `/etc/wsl.conf`. Restarting WSL interrupts its running
   workloads; finish them first.

3. Place a fresh source copy in the Linux home filesystem. Use Linux Node
   matching `.node-version` and Linux dependencies. Do not reuse Windows
   `node_modules` or share one writable SQLite state between Windows and WSL.

4. From the fresh source directory, run development checks:

   ```bash
   npm ci --ignore-scripts --no-audit --no-fund
   node scripts/prepare-config.cjs "$PWD"
   npm run check
   ```

   Example generation is once-only and refuses existing files. Examples are
   deliberately unconfigured; this step does not create working agents.

5. Complete runtime, role/MCP, workspace and authentication setup separately;
   see [setup](SETUP.md). An upstream desktop app does not provision this custom
   application. Credentials and installation-specific permissions stay local.

6. Review the Linux service installer before using it. It writes user units and
   launchers without enabling autostart and is not yet WSL-validated. A Windows
   shortcut into WSL differs from a Linux `.desktop` file. Verify controlled
   startup/shutdown before using the application for real work.

Check loopback Gateway readiness, read-only dashboard behavior and one scoped
model/tool call after account setup. Test browser/manual handoff independently:
Windows and Linux browsers have different executables and profiles. Do not expose
debugging ports or disable authentication to bridge them. No LAN access is needed.

## Route B: native Windows

Use the [LLM porting prompt](WINDOWS_PORT_PROMPT.md) for scoped implementation.
Historical owner-specific PowerShell launchers are omitted from the sanitized
edition. They may contain obsolete paths and schedules in a private checkout.

A development probe in a fresh PowerShell checkout can start with:

```powershell
Set-Location -LiteralPath $ProjectRoot
node --version
npm.cmd --version
git --version
npm.cmd ci --ignore-scripts --no-audit --no-fund
node scripts/prepare-config.cjs (Get-Location).Path
npm.cmd run check
```

Set `$ProjectRoot` to the actual checkout first. This is a probe, not a guaranteed
passing installer. Record Windows differences in child-process invocation,
POSIX modes, symlinks and cleanup; do not skip protections to force a pass.
Native work includes launch ownership, graceful stop, path quoting, host reports,
resource guards, browser discovery and appropriate credential/file ACLs.

## Acceptance and evidence

Record actual Windows OS/shell/Node/npm versions, source checks and runtime
results. Verify paths with spaces/Unicode, stale PID reuse, one-instance ownership,
missing credentials, read-only HTTP rejection, manual browser handoff and stop
with active work. Synthetic preparation creates no grants or sends. Keep
campaigns, cron, heartbeat, learning application and backup off unless separately
authorized. A generated PowerShell script is not verified Windows support.

Reference check: November 2, 2026. Preparing this guide did not install Windows
software, port the runtime, configure a machine or submit any applications.
