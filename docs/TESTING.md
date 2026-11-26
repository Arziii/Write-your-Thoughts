# Testing and verification

Record the exact command or manual workflow, actual result, relevant platform/dependencies, and unverified behavior. Use isolated local profiles and test books, and use disposable cloud projects for cloud verification.

| Change | Verification |
| --- | --- |
| Desktop or IPC | Run `npm --prefix app run build`, exercise dev or preview, and check preload/type/mock consistency. |
| Database | Initialize a fresh disposable SQLite DB through `initDatabase`, reopen it, and test version migration, foreign keys after save and restore, delete cascades, and expected sync queue mutations. For changes affecting compatibility, repeat against a fixture from the prior schema. |
| Sync or auth | Use separate disposable accounts/devices for offline local work, reconnect, role access, a rejected write, a conflict, and snapshot recovery. Verify actual cloud tables, Realtime coverage and bucket rules. |
| Maps | Paint contrasting textures and repeat a stroke, save/reopen and compare pixels. Check coast/water/eraser, large dirty regions, paths/bridge rendering, stamps, undo, layer visibility, movement/deletion, and map-image/pin cleanup. |
| Editor and audio | Test keyboard save, autosave, close/flush, book switching, version restore, real desktop playback, per-format export and actual file contents. For audio, include cancellation and partial output. |

## 2026-11-26 enhanced terrain assets

- **Passed** Windows production bundle and focused TypeScript checks for the map editor and imported modules.
- **Passed** an isolated Electron fixture with external requests blocked. All 12 enhanced PNGs and picker thumbnails decoded. Both legacy keys selected the replacement images. Opaque repeating tiles and a synthetic transparent-border control were verified.
- **Passed** painting grassland and crag artwork, preview/commit pixel parity and persistence after reload, layer visibility/move/delete, undo/redo, zoom anchoring, and Water, Eraser and Edge Brush regression checks. The packaged installer and any live project were outside this test.


## 2026-11-26 MAP-001 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after enlarging the atlas world canvas to `2560 × 1600` and updating `MapCanvas` viewport fitting (`out/main/index.js`, `out/preload/index.mjs`, and renderer bundle built cleanly).
- **Not run** Interactive desktop visual verification (painting, zooming, focus-mode toggle, and large-stroke tile compositing on existing saved maps) — left for the user to confirm in the running Electron app.

## 2026-11-26 audit verification

- **Passed** `npm.cmd --prefix app run build` on Windows with the existing dependencies and local asset tree. Pre-existing Vite mixed static/dynamic import notices were emitted.
- **Passed** a scratch sql.js fixture using the real TypeScript schema initializer and a stub for Electron's user-data path. It created 44 tables, reopened successfully, and verified queued chapter save and timeline columns. Map and reference cleanup triggers passed. **Failed** the original cascade assertion. SQLite foreign keys were off after export and deleting the fixture book left chapter and note rows. [Issue DB-01](KNOWN_ISSUES.md#db-01-sqlite-foreign-keys-after-export).
- **Blocked** `npm.cmd --prefix app run lint` due to missing ESLint configuration. **Blocked** `tsc -p app/tsconfig.json --noEmit` with `TS6305` for missing referenced declaration outputs involving Kokoro and timeline analysis.
- **Passed** 282 local Markdown link, anchor and path-case checks across README, AGENTS and docs. A credential-pattern scan of these documents found no matches. See the [handoff](HANDOFF.md) for scope.
- Live Supabase, clean dependency installation, packaged installer, GPU/audio playback, and a live Antigravity session were outside this audit's verification. The earlier map smoke checks belong to their own fixtures and are not counted as fresh checks.

The repository has no declared `npm test` command. Files such as `app/test.cjs`, `app/query.cjs`, and `app/clear_timeline.cjs` are local diagnostic or maintenance scripts with historical assumptions. They are unsuitable as a default test suite.
