# Write Your Thoughts

Write Your Thoughts is a desktop workspace for novelists and worldbuilders. Draft and organize a manuscript, develop its setting, and export the finished work.

![Write Your Thoughts logo](assets/Logo.png)

- Use the rich-text chapter editor, manuscript search, comments, and version history.
- Develop characters, locations, organizations, world rules, codex entries, wiki pages, notes, timelines, and relationships.
- Paint a fantasy atlas, add stamps, draw routes and rivers, and link pins to locations.
- Use AI if configured, listen with system voices or Kokoro, import manuscripts and worldbuilding exports from Campfire Writing or documents (`.html`, `.docx`, `.rtf`, `.pdf`, `.zip`, `.md`, `.txt`), and export to Markdown, DOCX, EPUB, PDF, or chapter WAV files.

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

**Latest repository update, 2026-11-27.** Removed Trust Level and Affection inputs from the graph relationship dialog. Existing scores are retained on edit. [GRAPH-002](docs/HANDOFF.md#graph-002-simplify-relationship-dialog).

**Earlier updates, 2026-11-27.** Upgraded the Relationships view into an interactive **Obsidian-style force-directed Story & Relationship Graph** (`GRAPH-001`) with live spring physics, degree-scaled circular nodes, neighborhood spotlighting, auto-detected story mentions, ReferencePage link graphing, cursor-anchored zoom/pan, and a floating Display & Forces panel (`IMP-001`–`IMP-004` added Campfire & multi-format `.pdf`/`.html`/`.docx`/`.rtf`/`.zip` project import + double-confirmed Clear Story Content; `MAP-010` refined Fantasy Map Studio's **Plains** biome). See [GRAPH-001](docs/HANDOFF.md#graph-001-interactive-obsidian-style-force-directed-story-and-relationship-graph).

The application uses the [MIT license](LICENSE). Models and artwork may carry separate terms. See the [map asset credits](assets/maps/LICENSES.md).
