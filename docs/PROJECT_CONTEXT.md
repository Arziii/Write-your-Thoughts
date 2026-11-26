# Project context

Write Your Thoughts is a local-first authoring application. Manuscript and reference material are organized by book. Authors can write chapters, develop a setting, optionally check the manuscript with AI, and export the book. Windows is the desktop platform exercised in the available local evidence. The project and package are named Write Your Thoughts.

## Stack and layout

The declared stack is Electron 29, electron-vite 2 with Vite 5, React 18, React Router 6 with hash routing, TypeScript 5, Tailwind 3, Zustand 4, Tiptap 2 and ProseMirror, and sql.js (SQLite in WASM). Integrations include Supabase Auth, Storage and Realtime, local and hosted LLM adapters, optional ComfyUI, and Kokoro through sherpa-onnx. See [package.json](../app/package.json) and the [resolved lockfile](../app/package-lock.json).

| Path | Responsibility |
| --- | --- |
| `app/src/main/` | Electron lifecycle, filesystem, schema initialization, main IPC |
| `app/src/preload/index.ts` | Bridge and subscriptions exposed as `window.api` |
| `app/src/renderer/src/` | Routes, components, Zustand stores, hooks, styles, services, contracts and UI art |
| `app/src/shared/` | Cross-process maps, reference pages, manuscript search, timeline, local AI, chat and Kokoro contracts |
| `app/scripts/`, `app/build/` | Voice model setup and package resources |
| `assets/` | Branding, historical screenshots, and atlas assets in `assets/maps/` |
| `app/out/`, `app/dist/` | Generated bundles, local fixtures and packages |
| `docs/`, `docs/modules/` | Team guidance, task records and technical references |

Run package scripts from `app/`. Keep privilege in main. Extend IPC through [handlers.ts](../app/src/main/ipc/handlers.ts), [preload](../app/src/preload/index.ts), [types](../app/src/renderer/src/types/electron.d.ts), and the [browser mock](../app/src/renderer/src/services/browserApiMock.ts) where applicable. Reuse existing styles and state owners. Keep stable entity IDs and check old data when changing a format.

The audit used the current source, assets inventory, local Git history and tags, build configuration, schema, IPC and a fresh build. `main` was at `04847b1` on 2026-11-26. The existing working tree includes features and assets beyond that commit. The available Git history contains 46 commits across refs, dated 2026-06-25 to 2026-11-19. See [Changelog](CHANGELOG.md) and [Current state](CURRENT_STATE.md).
