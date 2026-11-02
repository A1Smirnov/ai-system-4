# LLM coding prompt: native Windows portability

Paste this into a coding interface opened at a fresh source checkout. It scopes
source changes and isolated tests, not live accounts, automation or publication.

---

Adapt AI-System for native Windows. It is a custom OpenClaw application originally
developed on Windows and later migrated to Ubuntu. Current Ubuntu results do not
establish current Windows support. Read README.md, docs/ARCHITECTURE.md,
docs/SETUP.md, docs/LIMITATIONS.md and docs/WINDOWS.md. Inspect the actual checkout,
Git changes and applicable instructions. Preserve user changes. Distinguish
upstream OpenClaw Windows support from this application's platform assumptions.

## Objective and boundaries

Implement a minimal, reviewable native Windows Run/Stop/Status lifecycle for
Gateway and the read-only career dashboard. Preserve CommonJS, dependency locks,
Linux behavior, process ownership, readiness and controlled shutdown. Do not
rewrite the architecture or migrate the whole project to TypeScript.

- Use fictional isolated data and disabled templates. Never copy private state,
  credentials, mail, resumes, original role instructions or browser profiles.
- Placeholder approval references are not actual grants. Do not infer permission
  from an old installation, example file or a previous owner's conversation.
- Preserve loopback authentication, fixed MCP tools, host execution policy and
  exact package approvals. Do not add a public/debugging listener or general shell.
- Keep campaigns, business schedules, cron, heartbeat, automatic learning and
  backup disabled. No external sends, uploads, registrations or deployment.
- Do not weaken PowerShell policy, firewall, antivirus, sandbox, certificates or
  access controls to make startup pass.
- Prepare optional installers separately. Do not register tasks, enable boot/login
  autostart or change an existing live profile during source preparation.

## Implementation sequence

1. Inventory platform assumptions in scripts/*.sh, install-ai-system.py,
   scripts/systemd/, wait-ai-service.cjs, verify-clean-source.cjs,
   check-runtime-safety.cjs, security-ubuntu.cjs, dispatcher-v2.cjs,
   career-orchestrator.cjs, start-career-preparation.cjs, learning-owner.cjs,
   stop-gateway.cjs and career-submit.cjs. Classify portable code, Linux-only
   paths and existing Windows branches. Do not execute historical scripts blindly.

2. Add a small platform boundary where needed. Derive checkout paths; resolve
   Node/npm/PowerShell/browser executables explicitly. Pass argument arrays rather
   than interpolated shell text. Handle Windows `.cmd` spawning without injection.
   Test spaces, Unicode, drive separators, symlinks/junctions and path containment.

3. Add native Run/Stop/Status wrappers, preferably PowerShell over shared Node
   lifecycle code. Default to manual current-user execution without routine admin
   privileges. Report readiness and important logs without secrets/token URLs.
   Keep a named optional task/shortcut installer separate from starting services.

4. Start only Gateway and the read-only dashboard. Verify exact runtime/config
   ownership using executable, command line, owner and creation identity. A PID
   or occupied port alone is insufficient. Never kill all Node/Codex processes
   by name. An unverifiable stale lock must defer safely, preserving other work.

5. Stop new admissions, drain active authorized work, then close the owned process
   tree within a bounded timeout. Task Scheduler End/forced termination is not
   equivalent to a graceful drain. Unknown application outcomes still block replay.

6. Keep host reporting platform-specific. Preserve the Ubuntu collector; add a
   passive bounded Windows report with unknowns for unavailable evidence. Do not
   schedule scans or remediate the host. POSIX 0600 is not Windows ACL validation;
   verify current-user protection without expanding access.

7. Configure native OpenClaw/Codex/OAuth only in a separately authorized local
   setup step. Never share writable SQLite between Windows and WSL. Test WAL-aware
   backup/recovery on an isolated fixture, without overwriting private databases.

8. Discover the native browser through configuration. Preserve isolated profiles,
   manual CAPTCHA handoff and exact package approval. Do not enable submissions
   as a startup test or connect Windows/Linux debugging through an exposed port.

9. Run language/type/source checks and meaningful synthetic tests. Cover single
   ownership, PID reuse, missing credentials, startup failure, unauthorized tools,
   read-only HTTP rejection and pending work on stop. Add Windows CI only with
   synthetic data, immutable action revisions and minimal permissions. Do not
   silently skip security-critical tests to produce a green result.

10. Update English docs with exact commands, requirements, optional install/uninstall,
    rollback and verification boundaries. Retain Linux behavior and explain WSL2
    as an alternative. No autostart/campaign activation is implied by the port.

## Deliverables

Return a platform-assumption inventory, minimal source diff, documented lifecycle
commands, tests, optional installer design and rollback instructions. Distinguish
commands reviewed, tests run, services started and integrations actually checked.
If Windows execution is unavailable, deliver source preparation and explicitly
mark it untested. Native support requires an actual Windows run, not a generated
script, a Linux test result or a model's assertion of success.

---
