# Electron IPC API

[app/src/preload/index.ts](../app/src/preload/index.ts) is the actual `window.api` surface. [Main registration](../app/src/main/ipc/handlers.ts) and individual files in `app/src/main/ipc/` define channel behavior. [Renderer declarations](../app/src/renderer/src/types/electron.d.ts) and the [browser shim](../app/src/renderer/src/services/browserApiMock.ts) are separate checks when changing it.

| Namespace group | Responsibility |
| --- | --- |
| `window`, `system`, `auth`, `settings` | Window and deep-link events, local account metadata and settings |
| `books`, `chapters`, `editor`, `comments`, `search` | Manuscript state, save, versions, search and annotations |
| `database` | Queue and entity sync helpers, snapshot read and restore |
| `maps`, `characters`, `locations`, `referencePages`, `entities` | Map metadata and pins, records, rich details and ordering |
| `notes`, `codex`, `wiki`, `organizations`, `worldRules`, `storyBible` | Worldbuilding operations. See the preload for related profile and analysis namespaces |
| `timeline`, `timelineEvents`, `timelineSettings`, `verseTimeline` | Timeline, analysis, settings and the separate Verse timeline |
| `export`, `kokoro`, `localAI`, `studioImages`, `plugins` | Main-only filesystem, voice, loopback services and partial plugin file support |

For example, `window.api.chapters.getByBook(bookId)` reads chapters and `window.api.chapters.save({ id, content, wordCount })` queues an edit through the desktop handler. Validate user-derived input in main. Keep renderer-facing callbacks removable and test genuine Electron when changing a native capability.
