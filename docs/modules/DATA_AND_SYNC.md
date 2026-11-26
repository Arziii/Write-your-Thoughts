# Accounts, storage and synchronization

## Authentication and access

[authService.ts](../../app/src/renderer/src/services/authService.ts) uses Supabase password authentication, signup, reset and redirects handled through `wyt://auth/callback`. It calls the login-attempt RPCs around sign-in, and stores local profile information with [auth IPC](../../app/src/main/ipc/auth.ts). [supabase.ts](../../app/src/renderer/src/services/supabase.ts) configures the two Vite environment variables, session storage, refresh and the offline fetch guard. [App.tsx](../../app/src/renderer/src/App.tsx) restores workspace identity. Offline reuse is limited to an already cached desktop session with a corresponding local user. First login and cloud operations depend on Supabase.

Cloud authorization depends on deployed Postgres policies and storage rules. For example, the initial pull selects books by `owner_id` and relies on cloud row-level policies for unfiltered child-table reads. Source shows client expectations, not live grants. [Database](../Database.md) lists local relationships. [Known issues](../KNOWN_ISSUES.md) records gaps in provisioning and secret handling.

## Synchronization

[syncService.ts](../../app/src/renderer/src/services/syncService.ts) schedules periodic sync every minute during an active session and separately schedules daily SQLite snapshot backups when its queue and idle checks allow. [database IPC](../../app/src/main/ipc/database.ts) exposes queue reads and completion, typed-at-runtime table mappings, cloud upsert/conflict handling, and snapshot read/restore. The normal push groups pending operations by entity type/ID, takes the latest operation, upserts/deletes mapped tables, and acknowledges successful groups. Failed mapped operations remain pending. Conflict copies with the local suffix are skipped by push. Workspace JSON text is converted to cloud JSON values. Books map local `user_id` to `owner_id`.

| Lane | Code-backed coverage |
| --- | --- |
| Queued push | `cloud_books`, `cloud_chapters`, `cloud_chapter_versions`, `cloud_characters`, `cloud_locations`, `cloud_notes`, `cloud_codex`, `cloud_wiki`, `cloud_organizations`, `cloud_world_rules`, `cloud_workspace_state`. Chapter-version pushes are generated for milestones. Automatic snapshots remain local at row-sync level. Check the producer and mapping for each change. |
| Initial pull | Books, chapters, characters, locations, notes, codex, wiki, organizations, world rules, and workspace state. The initial pull does not enumerate cloud chapter versions. |
| Realtime registrations | Books, chapters, characters, locations, notes, codex and workspace state. Event application is in `App.tsx`. Coverage is narrower than push and initial pull. |
| Settings | `cloud_settings` with per-user serialized updates. Local revision marker `wyt-pending-settings-<userId>`; a pending local setting is protected during startup reconciliation. |
| SQLite snapshots | One DB file under the authenticated user's path in `user_backups`. The renderer calls `database.getBuffer` and `restoreBuffer`. Login only attempts automatic restore when the user has no local books and a backup is present. |
| Images | `storageService.uploadImage` writes to `images/<userId>/<entityType>/<entityId>.<ext>` in bucket/path notation and returns a public URL with a cache buster. A database snapshot can contain the URL. |

`publishBook`, `getSharedBooks`, `lockChapter`, and `unlockChapter` implement parts of collaboration. They use cloud book/chapter fields and `project_collaborators`. Full invitation and live co-edit workflows were unverified.

There is no granular map or reference-details mapping in this sync service. SQLite backups can contain `book_maps`, `map_pins`, `reference_page_details`, and local analysis rows. Snapshot recovery excludes separate map image files, renderer-only paint geometry, and IndexedDB chat history. Treat a snapshot restore as a database replacement and test it with a disposable copy.
