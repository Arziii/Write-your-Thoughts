# Decisions

| ID | When | Decision and reason |
| --- | --- | --- |
| DEC-001 | DOC-001 on 2026-11-26 | Root `AGENTS.md` is the single always-active file for Codex and Google Antigravity. Both officially support it, so shared guidance needs no duplicate platform rules. Detail stays in linked modules to keep startup context small. |
| DEC-002 | DOC-001 on 2026-11-26 | Keep the existing `docs/Architecture.md` and `docs/Database.md` paths as canonical. Keep short pointers at earlier documentation URLs where topics were consolidated. Preserve the historical Supabase SQL as a visibly archival reference. |
| DEC-003 | DOC-001 on 2026-11-26 | Runtime schema and code drive database documentation. Update README and task records every time. Data-impacting tasks reconcile the documented local schema, renderer/file boundaries, cloud mappings and migration behavior in the same change. |
| DEC-004 | Observed current architecture | SQLite IPC owns desktop records. Cloud synchronization and backup are separate from local writes. The atlas keeps drawn vectors in renderer storage, allowing editable layers while introducing a portability gap documented in [Database](Database.md). |
| DEC-006 | MAP-002 on 2026-11-26 | Keep terrain IDs as saved names, alias the two renamed files, and make repeating textures from the opaque interior of new cutouts. Use original images for thumbnails. This reuses saved layers and keeps transparent margins out of brush rendering. |
| DEC-005 | Observed current map renderer | SVG owns land masks and coast relief. The CPU tiled compositor owns terrain mixing. Vector data persists independently of texture tiles, which remain derived from local assets. Details and constraints are in [Map editor](modules/MAP_EDITOR.md). |
