# Write Your Thoughts

Write Your Thoughts is a desktop workspace for novelists and worldbuilders. Draft and organize a manuscript, develop its setting, and export the finished work.

![Write Your Thoughts logo](assets/Logo.png)

- Use the rich-text chapter editor, manuscript search, comments, and version history.
- Develop characters, locations, organizations, world rules, codex entries, wiki pages, notes, timelines, and relationships.
- Paint a fantasy atlas, add stamps, draw routes and rivers, and link pins to locations.
- Use AI if configured, listen with system voices or Kokoro, and export to Markdown, DOCX, EPUB, PDF, or chapter WAV files.

## Run locally

```powershell
cd app
npm.cmd ci
npm.cmd run dev
```

Run `npm.cmd run build` from `app/` to build the Electron bundles. On other shells use `npm` where appropriate. See [Setup](docs/SETUP.md) for account setup, local providers, and packaging.

## Data and offline use

Electron stores manuscripts and worldbuilding records in an on-device SQLite database using sql.js. A cached desktop account can reopen its local workspace offline after initial sign-in. Optional Supabase sync covers selected records. Imported map images are local files, painted map layers are saved in renderer storage, and AI Chat history uses IndexedDB. These storage boundaries determine what can be recovered on another device. See [Database](docs/Database.md) and [Data and sync](docs/modules/DATA_AND_SYNC.md).

## Documentation

| Start here | Purpose |
| --- | --- |
| [Project context](docs/PROJECT_CONTEXT.md) and [Architecture](docs/Architecture.md) | Goals, stack, layout, state, and process boundaries |
| [Features](docs/FEATURES.md) | Implemented, partial, and planned capabilities |
| [Current state](docs/CURRENT_STATE.md) and [Changelog](docs/CHANGELOG.md) | Audit baseline and task history |
| [Tasks](docs/TASKS.md), [Handoff](docs/HANDOFF.md), and [Known issues](docs/KNOWN_ISSUES.md) | Work status and limitations |
| [Testing](docs/TESTING.md) and [Decisions](docs/DECISIONS.md) | Verification and technical reasoning |
| [AGENTS.md](AGENTS.md) | Instructions shared by Codex and Google Antigravity |

**Latest repository update, 2026-11-26.** Enlarged the fantasy atlas world canvas to 2560 × 1600 and improved map viewport fitting in focus mode. See [MAP-001](docs/HANDOFF.md#map-001-larger-fantasy-map-canvas-and-viewport-fit).

The application uses the [MIT license](LICENSE). Models and artwork may carry separate terms. See the [map asset credits](assets/maps/map-assets/map-assets/LICENSES.md).
