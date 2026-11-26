# Changelog

## Unreleased on the audited working tree

### 2026-11-26

- **MAP-001.** Enlarged the atlas world canvas from `1600 × 1000` to `2560 × 1600` (`2.56×` drawing area), scaled max brush size to `480`, bumped terrain compositor tile cache to `160`, tightened `MapCanvas` fit margins, smoothed wheel zoom, and added auto-fit when toggling focus mode. No database changes.
- **MAP-002.** The Land Brush now bundles the enhanced PNGs alongside support for WebP and JPEG. Existing terrain names resolve to the current artwork, and transparent cutouts are prepared as opaque seamless brush tiles.
- **DOC-001.** Added the shared Codex and Antigravity workflow, data inventory, module guides, testing baseline, issue list and handoff format. Consolidated overlapping guides. Documentation only.
- **Existing working-tree development.** The audited changes include the fantasy atlas, terrain-aware paths and blended relief, richer worldbuilding pages, local narration and audiobook export, Chat Studio, and ongoing save and synchronization changes. This inventory describes the observed working tree. It has no release tag.

## Selected local history

| Reference | Evidence |
| --- | --- |
| `04847b1`, 2026-11-19 | Checked-out baseline for the audit |
| `v1.1.0-beta.1` → `89f0879` | Historical local tag before the audited working-tree changes |
| `v1.0.0-beta.1` → `a1eaed8` | Historical local tag |
| `bb73909`, `7d4f0af`, `2dc2eb0` | Earlier Supabase notes, Story Intelligence, and provider infrastructure |
| `88c8fe4`, `50d777a`, `328dfc6` | Earlier export, workspace, and account/sync implementations |

Use local Git history for individual historical changes. Use [Current state](CURRENT_STATE.md) for the source-backed baseline.
