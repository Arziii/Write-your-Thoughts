# Current state

**Last updated 2026-11-26 by Antigravity for MAP-001.** Version declared in `app/package.json` is `1.1.0-beta.1`. Audited baseline is local `main` at `04847b1` plus pre-existing modified and untracked source and assets.

- The fantasy atlas uses a `2560 × 1600` world canvas (max brush diameter `480`) with tighter viewport fit margins and auto-fit on focus mode toggle (`MAP-001`).
- The Land Brush loads the enhanced transparent PNG set. The brush crops opaque regions before generating repeating tiles, and legacy terrain names still resolve for existing map layers (`MAP-002`).
- The repository has one shared agent entry point in [AGENTS.md](../AGENTS.md) (verified natively discovered in Antigravity), an updated [README](../README.md), and focused [feature and module references](FEATURES.md).
- Source inspection found a working desktop code path for manuscript and worldbuilding tools, local atlas painting, AI providers and analysis, local audio, and document export. Cloud sync, collaboration and plugins have narrower coverage.
- The Electron build passed after `MAP-001`. The isolated SQL audit initialized 44 tables and verified queued saves and selected cleanup triggers. It also reproduced orphaned rows when SQLite foreign keys turned off after export. Lint and the direct TypeScript command are blocked by repository configuration/project references. See [Testing](TESTING.md).
- `MAP-001` and `MAP-002` changed only renderer map sizing/rendering and asset loading. SQLite schema, sync behavior, and saved map data formats were unaffected. Production Supabase schema and clean-checkout completeness remain unverified.

Start with the latest [handoff](HANDOFF.md), then check [tasks](TASKS.md) and [known issues](KNOWN_ISSUES.md).
