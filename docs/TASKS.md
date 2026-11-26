# Tasks

Use stable IDs. Add an owner and intended files for concurrent work. A proposed task is available for prioritization and gives no authorization to start on its own.

| ID | Status | Owner | Scope or evidence |
| --- | --- | --- | --- |
| MAP-002 | Completed | Codex | Load enhanced terrain artwork in the picker and brush while preserving legacy terrain keys. [Handoff](HANDOFF.md#map-002-load-enhanced-terrain-assets) |
| DOC-001 | Completed | Codex | Audit source and data, consolidate docs, and establish shared agent instructions. [Handoff](HANDOFF.md) |
| MAP-001 | Completed | Antigravity | Enlarge the fantasy atlas world canvas to `2560 × 1600` and improve viewport fitting/auto-fit in focus mode. [Handoff](HANDOFF.md) |
| DATA-001 | Proposed | Unassigned | Keep SQLite foreign keys enabled across exports and verify deletion, existing orphan handling, migration and restore. [DB-01](KNOWN_ISSUES.md#db-01-sqlite-foreign-keys-after-export) |
| DATA-002 | Proposed | Unassigned | Validate current Supabase schema and policies in a disposable environment. Add reproducible cloud migration and recovery instructions. [DB-02](KNOWN_ISSUES.md#db-02-cloud-provisioning-and-coverage) |
| DATA-003 | Proposed | Unassigned | Decide atlas package/export or sync scope for local files and draw layers. Cover reference details and other currently local data explicitly. [Database](Database.md) |
| BUILD-001 | Proposed | Unassigned | Establish reproducible lint/typecheck/test commands, cover critical Electron flows, and verify a clean Windows package from Git. [Testing](TESTING.md) |
| SEC-001 | Proposed | Unassigned | Review renderer security configuration, local IPC trust boundaries, and cloud settings/snapshot handling of provider credentials. [Known issues](KNOWN_ISSUES.md) |
| ASSET-001 | Proposed | Unassigned | Verify provenance and redistribution terms for the added colored artwork and path/terrain assets before distributing them. [Map editor](modules/MAP_EDITOR.md) |
