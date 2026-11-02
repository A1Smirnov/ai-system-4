# Local npm CLI dependency bundle

This source snapshot retains `npm-12.2.1.tgz` because the OpenClaw dependency
override and lockfile reference it. It is a local rebuild, not an official new
npm release. The adjacent provenance JSON records its SHA-256.

The 148 upstream npm 12.2.1 bin/lib files were compared without source differences.
Bundled Undici and ip-address dependencies were patched to 6.29.1 and 10.7.5.
Moderate dependency findings remain; this is not an audit-clean claim.

Reproduction inputs: `npm-security-package.json` and
`npm-security-package-lock.json`. Unpack upstream npm 12.2.1 in a separate build
directory, replace its package metadata with these inputs, run
`npm ci --ignore-scripts --omit=dev`, then `npm pack --ignore-scripts`.
Repeat source/integrity/license and install checks before using a rebuilt archive.
Different packing environments need not produce byte-identical archives.

Upstream LICENSE and bundled third-party notices remain inside the tarball.
The development test suite does not install this runtime dependency tree.
