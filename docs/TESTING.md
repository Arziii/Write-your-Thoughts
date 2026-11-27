# Testing and verification

Record the exact command or manual workflow, actual result, relevant platform/dependencies, and unverified behavior. Use isolated local profiles and test books, and use disposable cloud projects for cloud verification.

| Change | Verification |
| --- | --- |
| Desktop or IPC | Run `npm --prefix app run build`, exercise dev or preview, and check preload/type/mock consistency. |
| Database | Initialize a fresh disposable SQLite DB through `initDatabase`, reopen it, and test version migration, foreign keys after save and restore, delete cascades, and expected sync queue mutations. For changes affecting compatibility, repeat against a fixture from the prior schema. |
| Sync or auth | Use separate disposable accounts/devices for offline local work, reconnect, role access, a rejected write, a conflict, and snapshot recovery. Verify actual cloud tables, Realtime coverage and bucket rules. |
| Maps | Paint contrasting textures and repeat a stroke, save/reopen and compare pixels. Check coast/water/eraser, large dirty regions, paths/bridge rendering, stamps, undo, layer visibility, movement/deletion, and map-image/pin cleanup. |
| Editor and audio | Test keyboard save, autosave, close/flush, book switching, version restore, real desktop playback, per-format export and actual file contents. For audio, include cancellation and partial output. |

## 2026-11-27 GRAPH-002 verification

- **Passed** `npm.cmd --prefix app run build`.
- **Passed** an isolated Electron fixture using mock relationship IPC. Both dialogs displayed the five remaining fields. Creation sent 5 for each score. Editing retained fixture scores of 8 and 2.

## 2026-11-27 GRAPH-001 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after creating `storyGraphEngine.ts` and rebuilding `RelationshipGraphView.tsx`: compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,144 modules) cleanly with exit code `0` in `9.59s`.
- **Verified unchanged** `git status --short app/src/main app/src/preload app/src/renderer/src/services/syncService.ts` returned zero modified files.
- **Not run** Live interactive Electron testing (`npm.cmd --prefix app run dev`) of force-directed physics dragging, hover neighborhood spotlighting, Display/Forces sliders, **Story Web** auto-mentions, **Connect** mode, and Relationship CRUD against a multi-chapter book.

## 2026-11-27 IMP-004 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after adding `discardEditorSaves` in `useEditorSave.ts`, creating `bookContentCleaner.ts` and `ClearStoryContentModal.tsx`, and wiring **Clear Existing Content…** / **Clear Story Content** into `ImportModal.tsx` and `Sidebar.tsx`: compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,143 modules) cleanly with exit code `0` in `10.70s`.
- **Verified unchanged** `git status --short app/src/main app/src/preload app/src/renderer/src/services/syncService.ts` returned zero modified files.
- **Not run** Interactive Electron smoke check of `ClearStoryContentModal` counting, typed `CONFIRM` unlock/deletion across categories, active tab closing, and Fantasy Maps preservation in `npm.cmd --prefix app run dev`.

## 2026-11-27 IMP-003 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after updating `pdfParser.ts` (`getOperatorList` + `commonObjs` bold/italic resolution, geometric `fitsOnPrevLine`/`styleChanged` paragraph breaks), `documentParsers.ts` (`mergeOrphanSubSections`), and `projectImporter.ts` (`cleanChapterCandidateHeader`): compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,141 modules) cleanly with exit code `0` in `6.72s`.
- **Passed** Node.js multi-font PDF metadata smoke check via `page.getOperatorList()` + `page.commonObjs` verifying accurate bold (`Helvetica-Bold`) vs. body (`Helvetica`) font detection.
- **Verified unchanged** `git status --short app/src/main app/src/preload app/src/renderer/src/services/syncService.ts` returned zero modified files.
- **Not run** Live interactive Electron testing (`npm.cmd --prefix app run dev`) re-importing the user's `Campfire Export.pdf` to confirm promoted chapter titles, clean leading headers, separate subheading blocks (`Day 1: The Hunt`, `Nobody's POV`), and unified `Chapter 10: Fire on the Horizon`.

## 2026-11-27 IMP-002 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after installing `pdfjs-dist@4.10.38`, creating `pdfParser.ts`, wiring it into `documentParsers.ts`, and upgrading `projectImporter.ts` and `ImportModal.tsx`: compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,141 modules, splitting `pdfjs-dist` into `assets/pdf-*.js` `789.94 kB` and `assets/pdf.worker-*.js` `2,320.56 kB`) cleanly with exit code `0` in `9.03s`.
- **Passed** Node.js runtime smoke test loading `app/node_modules/pdfjs-dist/legacy/build/pdf.mjs` + `pdf.worker.mjs` via `globalThis.pdfjsWorker` against an in-memory PDF buffer, returning exact extracted text (`Chapter 1: Hello World`).
- **Verified unchanged** `git status --short app/src/main app/src/preload app/src/renderer/src/services/syncService.ts` returned zero modified files.
- **Not run** Live interactive Electron testing (`npm.cmd --prefix app run dev`) re-importing the user's combined 107-page Campfire PDF (`Campfire Export.pdf`) to inspect each decoded chapter, character sheet, location, world rule, and timeline event inside the desktop app.

## 2026-11-27 IMP-001 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after creating `zipReader.ts`, `documentParsers.ts`, `projectImporter.ts`, and `ImportModal.tsx` and wiring import buttons into `Sidebar.tsx` and `Dashboard.tsx`: compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,138 modules) cleanly with exit code `0` in `7.67s`.
- **Verified unchanged** `git status --short app/src/main app/src/preload app/src/renderer/src/services/syncService.ts` returned zero modified files.
- **Not run** Live interactive Electron testing (`npm.cmd --prefix app run dev`) importing actual Campfire `.html`, `.docx`, `.rtf`, `.pdf`, or `.zip` exports into chapters, character sheets, locations, reference pages, and `verseTimeline` events.

## 2026-11-27 MAP-010 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after updating `Plains` & `Desert` definitions, adding stretched prairie noise + `paintPlainsOverlay` (re-captured into `tile.pixels`) in `terrainSurface.ts`, and adding grass-tuft & dune motifs in `terrainAssets.ts`: compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,134 modules) cleanly with exit code `0` in `7.02s`.
- **Not run** Interactive desktop visual verification (`npm.cmd --prefix app run dev`) of `Plains` seamlessness and contrast alongside `Grassland` and `Desert`.

## 2026-11-27 MAP-009 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after upgrading Draft-to-Map to **High Detail** default (`960px` chunked async tracing with `O(W·H)` separable filters in `mapContourTracer.ts`, 2-pass `1600px` Vision AI in `mapDraftAnalyzer.ts`, raised JSON output token limits in `OpenAIProvider`/`GeminiProvider`/`OpenAICompatibleProvider`, refined biome brush diameters in `mapDraftBuilder.ts`, and `High Detail` / `Fast Draft` selector + live progress bar in `MapDraftImportModal.tsx`): compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,134 modules) cleanly with exit code `0` in `7.00s`.
- **Not run** Live desktop testing comparing `High Detail` (`960px` + 2-pass Vision AI) vs. `Fast Draft` (`420px`) on detailed fantasy maps in `npm.cmd --prefix app run dev`.

## 2026-11-27 MAP-008 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after adding offline inland Sobel mountain/forest/settlement stamp detection, continental-spine `suggestedStamps` auto-placement, calibrated `Plains` vs. `Highlands` biomes, open-ocean strait exclusion in `traceOfflineRivers`, and granular Mountain / Forest / Settlement / Auto-place toggles in `MapDraftImportModal.tsx`: compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,134 modules) cleanly with exit code `0` in `7.13s`.
- **Not run** Interactive desktop testing re-importing the user's reference map draft in `npm.cmd --prefix app run dev` to visually confirm `Plains` biomes, ocean-strait river elimination, and placed Mountain / Forest / Settlement stamps.

## 2026-11-27 MAP-007 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after adding `'Polygon'` terrain shape support, implementing `generateJSONWithImage` + `parseModelJson` across all 4 AI provider adapters, creating `mapContourTracer.ts`, `mapDraftAnalyzer.ts`, `mapDraftBuilder.ts`, and `MapDraftImportModal.tsx`, and wiring **Draft to Map** into `MapTopBar.tsx` and `ParchmentMapTools.tsx`: compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,134 modules) cleanly with exit code `0` in `8.05s`.
- **Not run** Interactive desktop testing of uploading paper sketches and colored map drafts through Cloud Vision AI, Local Vision AI (Ollama/LM Studio), and Built-in Offline Analyzer fallback, nor live verification of generated `'Polygon'` coastlines, `Paint biome` alignment, stamps, and `Ctrl+Z` undo in `npm.cmd --prefix app run dev`.

## 2026-11-27 MAP-006 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after expanding coastline **Roughness** to `0–40` (`MAX_ROUGHNESS = 40`, default `8`) with 4 presets (`Smooth 0`, `Gentle 8`, `Natural 20`, `Rugged 36`), centered 4-octave `fractalNoise` SVG displacement in `ParchmentMapTools.tsx`, synchronized 4-octave `TerrainCompositor` masks in `terrainBlend.ts`, and `RoughnessControl` exposure across `Sculpt land`, `Carve water`, `Shape brush`, `Edge brush`, and `Water brush` in `MapInspector.tsx`: compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,130 modules) cleanly with exit code `0` in `5.71s`.
- **Not run** Interactive desktop visual/pointer verification of high-roughness strokes (`20`–`40`), `Carve water`, `Paint biome` edge coverage, and `Shape brush` fractal borders in `npm.cmd --prefix app run dev`.

## 2026-11-27 MAP-005 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after enlarging the atlas canvas to `3840 × 1920`, adding `mapScale.ts` (`40,075 km` Earth default, presets, two-point calibration, travel times, scale bar), wiring the `Ruler` (`R`) overlay/rubber-band preview, and updating `MapInspector.tsx` and brush sizes up to `640px`: compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,130 modules) cleanly with exit code `0`.
- **Not run** Interactive desktop check of Ruler waypoint placement, `Backspace`/`Esc` handling, Earth/custom scale calibration, travel time readouts, and zoom-responsive scale bar in `npm.cmd --prefix app run dev`.

## 2026-11-27 MAP-004 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after deleting the 12 old battlemap terrain PNGs, flattening `assets/maps/{stamps,paths,waters,manifest.json,LICENSES.md,ORIGINAL_README.txt}`, moving 8 loose sample files to `assets/samples/`, consolidating the 14 map files into `components/world/map-editor/`, adding the 8 procedural biomes, adding `Sculpt land` / `Paint biome` (`clipToLand`), `X` toggle, 4 size dots, and inline pickers, and updating the default ocean backdrop + coastal shallow glow + UI swatches to marine blue (`#357b9e` / `#225b80` / `#163f5e`, shallows `#7ad1df`): compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,129 modules) cleanly with exit code `0`. Confirmed none of the 12 deleted terrain PNGs appear in `out/renderer/assets/`, while all stamps, road/river strips, and both water PNGs bundled cleanly.
- **Passed** `git grep "map-assets/map-assets" -- app/` returned zero matches.
- **Not run** Interactive desktop canvas painting verification of procedural biomes, `Paint biome` coastline clipping, `X` add/carve toggle, and legacy saved-map rendering in `npm.cmd --prefix app run dev`.

## 2026-11-27 MAP-003 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after wiring the `waters/` textures into `terrainAssets.ts`, `terrainBlend.ts`, `ParchmentMapTools.tsx`, and `MapInspector.tsx`: compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,145 modules) cleanly with exit code `0`, and verified both `Painterly Deep Blue Water Splash-2` (`1,913.91 kB`) and `Painterly Turquoise Water Pool-1` (`1,939.77 kB`) in `out/renderer/assets/`.
- **Not run** Interactive desktop painting smoke check of textured water strokes, coastal carving, scale/rotation, and Eraser masking in `npm.cmd --prefix app run dev` — left for live visual confirmation.

## 2026-11-26 UI-001 verification

- **Passed** `npm.cmd --prefix app run build` on Windows after all `UI-001` renderer edits (including `ParchmentMapTools.tsx`, the `Switch` / `SettingsPage.tsx` theme fixes, and assigning unique `lucide-react` icons across `MapToolRail.tsx` and `MapInspector.tsx`): compiled `out/main/index.js` (42 modules), `out/preload/index.mjs` (1 module), and `out/renderer/` (2,143 modules) cleanly with exit code `0` (pre-existing Vite static/dynamic import chunking notices only).
- **Blocked** `app\node_modules\.bin\tsc.cmd -p app\tsconfig.json --noEmit` with pre-existing `TS6305` errors for missing `app/dist/src/{main/ipc/kokoro,shared/kokoro,shared/timelineAnalysis}.d.ts` referenced declaration outputs (same pre-existing repository issue noted under audit verification).
- **Not run** Interactive visual/runtime smoke test inside the live Electron window for resizable panels, Command Palette (`Ctrl+K`), selection bubble, categorized Settings, Dashboard goal editing, and Fantasy Map Studio `Space`/right-click pan & inspector tabs — left for the user to inspect visually in `npm.cmd --prefix app run dev`.

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
