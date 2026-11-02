# Privacy and repository contents

The distribution is built from an explicit source allowlist into a new directory.
It does not copy `.git`, `node_modules`, working configuration, SQLite databases,
sessions, mail, account credentials, browser profiles, resumes, application records,
logs, reports, backups or personal agent workspaces. Historical migration documents
are replaced by source-edition documentation.

Personal names, local account paths, project domains, historical employer examples
and hardcoded candidate assertions are removed from the selected sources. General
California place names and illustrative coordinates remain as implementation data.
The local npm archive is checked separately, including its text members.

The manifest records distributed file hashes and sizes. Original commit IDs,
author metadata, conversation/approval reference IDs and Git history are excluded.
This is a working-tree snapshot, including uncommitted source changes, rather
than a claim that it equals an upstream commit.

Pattern scanning is a review aid, not proof that every possible sensitive value is
absent. Inspect the final file list before publication. Publishing also exposes
architecture, role names, dependency versions, policies and known limitations.

Use a new repository for this source edition. Copying the original `.git` or adding
the live project directory would reintroduce history and excluded information.
Keep local generated configuration and runtime state ignored after cloning.

## SQLite is private data, not source

Working databases can contain tasks, transcripts, candidate facts, materials,
outcomes and account/authorization state. Their file extension does not provide
encryption. A schema can reveal workflow metadata even without table rows.

Do not publish `.sqlite`, `.sqlite3`, `.db` or associated `-wal`, `-shm` and
journal files. Renaming a database does not sanitize its contents. Deleting rows
can leave recoverable data in unused pages; see the [SQLite documentation](https://www.sqlite.org/lang_vacuum.html).
WAL files hold database changes and must be treated as private state too; see
[SQLite WAL](https://www.sqlite.org/wal.html). This edition excludes databases
entirely rather than attempting to redact a working copy. Tests create new
fictional temporary databases and never ship those files.
