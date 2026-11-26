# Shared project instructions

Codex and Google Antigravity use this repository-wide instruction file. Open the repository root in either tool.

## Before each task

1. Read this file, [Current state](docs/CURRENT_STATE.md), [Handoff](docs/HANDOFF.md), [Tasks](docs/TASKS.md), and [Known issues](docs/KNOWN_ISSUES.md).
2. Run `git status --short`. Check active task ownership and preserve pre-existing edits. Coordinate overlapping writes with the other agent before editing shared files.
3. Review the relevant [architecture](docs/Architecture.md) and modules below. Inspect the actual source and relevant callers to verify the docs and avoid duplicating completed work.

| Area | Read when relevant |
| --- | --- |
| Database, auth, storage, sync | [Database](docs/Database.md) and [Data and sync](docs/modules/DATA_AND_SYNC.md) |
| Maps, rendering, assets, brushes | [Map editor](docs/modules/MAP_EDITOR.md) |
| Chapters, tabs, save, export, read aloud | [Manuscript and audio](docs/modules/MANUSCRIPT_AND_AUDIO.md) |
| Characters, locations, reference pages, timelines | [Worldbuilding](docs/modules/WORLDBUILDING.md) |
| Providers, assistant panels, chat, local models | [AI and Story Intelligence](docs/modules/AI_AND_STORY_INTELLIGENCE.md) |
| Commands and verification | [Setup](docs/SETUP.md) and [Testing](docs/TESTING.md) |

## During development

- Work within the requested scope. Follow the existing TypeScript, React, Zustand, Tiptap, IPC, and persistence conventions. Reuse established normal entry points.
- Track progress and ownership in [Tasks](docs/TASKS.md) for work that spans sessions or agents. Record significant choices in [Decisions](docs/DECISIONS.md) and newly confirmed problems in [Known issues](docs/KNOWN_ISSUES.md).
- For data work, trace writes, reads, migrations, ownership, and cloud sync/recovery as applicable. For IPC changes, check registration, preload, renderer-facing types, and browser behavior together. Keep credentials and production data out of documents, fixtures, and logs.
- Verify actual behavior. Preserve existing projects and check retries, partial failures, and local versus remote storage where relevant.

## Before completing or handing off

- Update [README](README.md), [Current state](docs/CURRENT_STATE.md), [Tasks](docs/TASKS.md), [Changelog](docs/CHANGELOG.md), and [Handoff](docs/HANDOFF.md) for every development task. Keep the README update brief and factual. Update impacted modules and the architecture, decisions, and known issues when applicable.
- Review README and documentation claims against the database every task. For persistence changes, update the README's data summary, [Database](docs/Database.md), [Data and sync](docs/modules/DATA_AND_SYNC.md), and affected feature guides in the same task. Check `app/src/main/database/init.ts`, affected IPC handlers, and `app/src/renderer/src/services/syncService.ts`. Distinguish SQLite rows, files, renderer storage, and cloud behavior. When database behavior stays the same, record that in the handoff.
- Record actual checks, outcomes, and limits in [Testing](docs/TESTING.md) or link the evidence there. Use the [handoff format](docs/HANDOFF.md) for completed or interrupted tasks. A development task is complete after relevant documentation and actual verification results are recorded.
