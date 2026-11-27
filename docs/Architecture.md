# Application architecture

## Electron boundary

[Main](../app/src/main/index.ts) handles the single-instance window, `wyt://` authentication links, database initialization, main IPC and updater. Dev loads Vite and detaches DevTools. The packaged window loads the built HTML. The close handshake lets the renderer flush queued editor writes before closing.

[Preload](../app/src/preload/index.ts) exposes capabilities through `contextBridge`. See [IPC API](API.md) for the contract. Window configuration enables context isolation and disables renderer Node integration. It currently disables renderer sandboxing and web security. See [Known issues](KNOWN_ISSUES.md).

## Renderer and state

[Renderer main](../app/src/renderer/src/main.tsx) installs the browser mock if needed and mounts hash routing. [App](../app/src/renderer/src/App.tsx) bootstraps account and local workspace, starts cloud scheduling, and reconciles settings. [AppLayout](../app/src/renderer/src/layouts/AppLayout.tsx) hosts global `Ctrl+K` Command Palette triggers, resizable sidebar layout, and window chrome. [WorkspacePage](../app/src/renderer/src/pages/workspace/WorkspacePage.tsx) loads book records and [EditorView](../app/src/renderer/src/pages/workspace/EditorView.tsx) dispatches the active tool or document and manages the unified resizable Right Inspector. Shared controls live in [primitives](../app/src/renderer/src/components/ui/primitives.tsx) and [ResizeHandle](../app/src/renderer/src/components/ui/ResizeHandle.tsx).

| Store | Responsibility |
| --- | --- |
| [workspaceStore](../app/src/renderer/src/stores/workspaceStore.ts) | Active book and chapter, tabs, entity lists, pane state, selection and drafts |
| [userStore](../app/src/renderer/src/stores/userStore.ts) | Current user and settings |
| [cloudSyncStore](../app/src/renderer/src/stores/cloudSyncStore.ts) | Sync queue and backup status |
| [storyBibleStore](../app/src/renderer/src/stores/storyBibleStore.ts) | Book reference data and AI context |
| [toastStore](../app/src/renderer/src/stores/toastStore.ts) | Feedback |

## Data flow

The desktop write path is UI → state or save hook → `window.api` → main IPC → SQLite or filesystem. `initDatabase` initializes local tables and legacy migrations. `dbRun` saves SQLite to disk. `dbRunQueuedEdit` can transact an entity update, a pending sync entry, and related writes. Renderer `syncService` separately pushes supported rows, pulls remote updates, and can upload or restore a SQLite snapshot. Map brush layers, cached sessions, and AI Chat use renderer storage. See [Database](Database.md) and [Data and sync](modules/DATA_AND_SYNC.md).

## Rendering and domain modules

- [Manuscript and audio](modules/MANUSCRIPT_AND_AUDIO.md) covers Tiptap HTML, autosave, version history, local narration and export.
- [Map editor](modules/MAP_EDITOR.md) covers world-space SVG terrain and coastline masks, tiled Canvas 2D compositing, atlas paths, stamps and local assets.
- [Worldbuilding](modules/WORLDBUILDING.md) covers record forms, relationships, timelines, and reference pages.
- [AI and Story Intelligence](modules/AI_AND_STORY_INTELLIGENCE.md) covers provider selection, loopback requests, ComfyUI, analysis and local chat history.

[electron.vite.config.ts](../app/electron.vite.config.ts) builds main, preload and renderer separately and allows the map asset source in dev. [Tailwind](../app/tailwind.config.js) and [PostCSS](../app/postcss.config.js) compile the renderer styles. Theme tokens and layout classes live in [index.css](../app/src/renderer/src/index.css). The [app TypeScript config](../app/tsconfig.json) references a composite [main/preload/shared project](../app/tsconfig.node.json) that emits to the dist directory.
