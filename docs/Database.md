# Database and storage reference

The source of truth for local DDL is [app/src/main/database/init.ts](../app/src/main/database/init.ts), especially `initDatabase`, `createTables` and the post-DDL compatibility migrations. The database file is `<Electron userData>/database/write-your-thoughts.db`. SQLite loads into memory and exports the database file after writes. Initialization requests foreign key enforcement. The current sql.js export resets that flag in the tested path. Main IPC also enforces some relationships and cleanup through application checks and triggers. See [DB-01](KNOWN_ISSUES.md#db-01-sqlite-foreign-keys-after-export).

## Local schema by ownership

| Record group | Tables and relationships |
| --- | --- |
| Account | `users` has the Supabase user ID as the local primary key. `settings`, `workspace_state`, and `books` refer to the user. `settings` stores editor and AI preferences. Workspace fields include open tabs and panel state as JSON text. |
| Manuscript | `books` has many `chapters` via `book_id`. `chapters.content` holds HTML, with word count and order stored separately. `chapter_versions` and `comments` belong to chapters. Local chapter version columns include `snapshot_type`, `milestone_name`, `word_count`, and `user_id`; legacy columns may remain after migration. |
| Worldbuilding | `characters`, `locations`, `notes`, `codex`, `wiki`, `organizations`, `world_rules` and `story_bibles` refer to books. Profile tables reference the relevant entity. `lore_entries` refers to codex. `reference_page_details` has composite key `(kind, entity_id)` with book-scoped JSON text and cleanup triggers for entity or book deletion. |
| Maps | `book_maps` belongs to a book. `map_pins` uses composite key `(map_id, location_id)` and normalized x/y. Main checks that a pin's location and map belong to the same book. Indexes and foreign keys or cleanup triggers support reads and deletion. |
| Voice and analysis | `character_voice_profiles`, `speech_patterns`, `dialogue_samples` belong to characters. Chapter analysis uses `chapter_emotions`, `scene_emotions`, `continuity_events`, `continuity_warnings`, `chapter_metrics`, and `chapter_statistics`. `style_profiles`, `story_analysis`, `arc_analysis`, `pacing_analysis`, and `emotion_analysis` are book-scoped, with arc analysis also keyed through character references. |
| Relationships | `character_relationships` refers to a book and its source/target characters. `relationship_events` and `relationship_states` refer to a relationship and optionally or necessarily to a chapter depending on the table. States are unique per relationship/chapter. |
| Timeline | `timeline_events` and `verse_timeline_events` are book-scoped. `timeline_settings` and `timeline_analyses` are keyed by book. Effective timeline columns include `story_day`, `chapter_id`, `characters_involved` and `duration_days` via migrations. The earlier `CREATE TABLE IF NOT EXISTS` wins on clean databases, so additional foreign keys in the later definition do not get added automatically. |
| Change queue | `sync_queue` holds entity type, ID, operation, status and timestamp. The entity/status index supports coalescing and reads. Some IPC writes use `dbRunQueuedEdit` to transact edits with the queued update. |

See the exact column defaults, foreign keys, indexes and legacy ALTERs in the source. When changing SQLite, check an empty database and a database initialized with the earlier schema. Use [Testing](TESTING.md) for the workflow.

## Boundaries outside SQLite

| Data | Location |
| --- | --- |
| Imported raster map bytes | `<userData>/map-images/<mapId>` |
| Painted geometry, brushes, stamps, labels and atlas paths | renderer localStorage under `wyt-parchment-map-<mapId>` |
| Last selected atlas | renderer localStorage under `wyt-map-selection-<bookId>` |
| AI Chat threads and turns | IndexedDB database `wyt-chat-studio` |
| System and Kokoro reading choices, saved Supabase session and selected UI caches | renderer storage |
| Uploaded book/character/location images | Supabase `images` bucket through [storageService](../app/src/renderer/src/services/storageService.ts) |
| Cloud settings and backups | `cloud_settings` and the `user_backups` bucket |
| Local plugin files | `<userData>/plugins/` |

The code's actual row sync mapping, settings/backup coverage and auth are in [Data and sync](modules/DATA_AND_SYNC.md). The [historical SQL](Supabase-Setup.md) differs from current runtime expectations and is reference material.
