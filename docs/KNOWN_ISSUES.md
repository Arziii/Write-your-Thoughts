# Known issues

Evidence here is scoped to the repository or test noted. Follow-up IDs are in [Tasks](TASKS.md).

## DB-01 SQLite foreign keys after export

**Reproduced on 2026-11-26.** [Database initialization](../app/src/main/database/init.ts) sets `PRAGMA foreign_keys = ON`, then `saveDb` exports via sql.js. The isolated fixture observed foreign keys off after export. Deleting a fixture book left chapter and note rows. The map, map-pin and reference-detail triggers removed their rows. [books IPC](../app/src/main/ipc/books.ts) deletes the book row and handles imported map files. Verify connection state across save and restore, plus existing orphans, before any repair. See [Testing](TESTING.md).

## DB-02 Cloud provisioning and coverage

[Historical Supabase SQL](Supabase-Setup.md) has unprefixed table names and a migration placeholder. [Runtime sync](../app/src/renderer/src/services/syncService.ts) expects `cloud_*` tables, collaboration fields and storage policies. No current deployment or versioned cloud migration was verified. Initial pull and Realtime cover fewer tables than push, and initial child-table failures can be logged while the overall pull reports success. Map artwork/paint and chat history are outside SQLite snapshot recovery, and granular sync excludes maps and reference details. See [Data and sync](modules/DATA_AND_SYNC.md).

## DB-03 Duplicate timeline DDL

`createTables` declares `timeline_events` twice. In the fresh fixture, migrations added `chapter_id` and other missing columns, while the relationship list still contained only the book foreign key. Check installed databases before changing constraints.

## SEC-01 Renderer and persisted credentials

[Electron window configuration](../app/src/main/index.ts) currently disables web security and sandboxing. Context isolation and disabled Node integration are configured. Treat IPC and remote content boundaries as a review item before a release.

[Settings IPC](../app/src/main/ipc/settings.ts) persists provider configuration. [Cloud settings and SQLite backup paths](../app/src/renderer/src/services/syncService.ts) serialize local settings or the database without an explicit provider-credential scrub in those functions. Verify cloud access policy and credential handling before changing or promoting these flows. Keep real secrets out of audit material.

## BUILD-01 Validation gaps

The 2026-11-26 Vite/Electron bundle build passed. ESLint reports missing repository configuration. Direct project type-check reports `TS6305` for referenced declaration outputs. No defined npm test script, committed CI workflow or supported cross-platform package verification was found in the checkout. Some source and assets are untracked in the audited working tree. See [Testing](TESTING.md).

## MAP-01 Large maps and provenance

Map brush geometry is localStorage JSON. Very large drawings can hit storage quota, and in-memory undo has a fixed history cap. Atlas terrain classification reads authored layers and stamps. For imported raster images, choose a manual road texture. A renderer that was open when the terrain assets were replaced can still use its previous catalog. Restart the dev app after replacing source textures and rebuild any distributed copy to include them. The CC0 notice applies to the credited stamps. Additional artwork and texture provenance needs review. See [Map editor](modules/MAP_EDITOR.md) and the [included license inventory](../assets/maps/map-assets/map-assets/LICENSES.md).

## AI-01 Provider and playback variability

Hosted and local AI features depend on the configured service, available models, and valid responses. AI analysis is heuristic. Kokoro preview and chapter playback process different text and passage boundaries, and the source has no verified guarantee of matching prosody. Installed voices and local model readiness vary by system.
