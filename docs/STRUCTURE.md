# Source distribution layout

```text
AI-System/
├── app/
│   ├── package.json, package-lock.json
│   └── vendor/                    Documented npm bundle and provenance
├── extensions/personal-operations/
│   ├── index.mjs, status.cjs
│   ├── ui/                        Interface source
│   └── dist/control-ui/           Current manifest-selected build
├── integrations/outlook/          Dependency manifest and lock only
├── personal-system/control/      Application source; no live policy JSON
├── scripts/                      Lifecycle, diagnostics and source checks
│   └── systemd/                  Manual Linux user-service templates
├── tests/                        Synthetic workflows and negative tests
├── types/, tsconfig.json         Incremental strict checking
├── config-templates/             Disabled examples, not owner permissions
│   ├── control/
│   ├── data/
│   └── state/
├── .github/workflows/            Development CI without working credentials
├── docs/                         Setup, architecture, privacy and Windows guides
├── README.md, THIRD_PARTY_NOTICES.md
├── package.json, package-lock.json, .node-version
└── SOURCE-MANIFEST.json          Distributed file sizes and hashes
```

The configured working installation has additional private directories:
`state/`, `workspace/`, `personal-system/data/`, role workspaces, project snapshots,
candidates, assets, browser profiles and `outputs/`. They are absent here, along
with installed dependencies and the original `.git`. Examples under
`config-templates/data/` and `config-templates/state/` are not live state copies.

The migrated Ubuntu installation uses `state/state/openclaw.sqlite` for native
state and `personal-system/data/registry.sqlite` for application state. A new
installation can differ; do not move a working database to match a diagram.
