# Setup

## Develop on Windows

1. Open the repository root. Use a Node.js and npm installation compatible with [app/package.json](../app/package.json) and its lockfile. This audit ran the development checks on Windows with Node 24.18.0 and npm 11.16.0.
2. Install dependencies using `npm.cmd ci` from `app/` on PowerShell. Run `npm.cmd run dev` from that directory. The default desktop app opens with DevTools detached. The baseline build used the dependencies already installed in the working tree.
3. Run `npm.cmd run build` to produce bundles in `app/out/`. Run `npm.cmd run preview` to exercise the bundled app. Preview and dev expose different renderer origins. Test storage behavior in the target desktop mode.
4. For Windows distribution, `npm.cmd run dist:win` prepares Kokoro resources, builds, and requests an x64 NSIS package. The prep script uses `curl.exe` and `tar.exe` if model assets are missing and checks the archive digest. `npm.cmd run release` is the separate publishing command and requires release authorization.

On other shells use `npm`. The package lists macOS/Linux icon settings, but current x64 Windows packaging is explicit. Other platform builds have not been verified.

## Account, storage and local services

- Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in ignored `app/.env` if connecting to your Supabase project. Use the public client value and configure the `wyt://auth/callback` redirect. First sign-in depends on a configured account. Do not put a privileged cloud secret in a Vite variable.
- For cloud provisioning, first review [runtime table and bucket requirements](modules/DATA_AND_SYNC.md), [DB-02](KNOWN_ISSUES.md#db-02-cloud-provisioning-and-coverage), and [the historical SQL](Supabase-Setup.md). Validate actual schemas, migrations and access policies in a disposable Supabase project before use.
- Configure AI in Settings. For Ollama or LM Studio, start the service on the same machine, install a model, and use the connection test. The provider factory reads the chosen device address and model. For AI Chat images, install a supported local ComfyUI runtime and checkpoint, then configure **AI Chat → Image setup**. See [AI and Story Intelligence](modules/AI_AND_STORY_INTELLIGENCE.md).
- **Settings → Read Aloud** uses installed system voices or Kokoro. For Kokoro in dev run `npm.cmd run setup:kokoro` in `app/` if the model is unavailable. See [Manuscript and audio](modules/MANUSCRIPT_AND_AUDIO.md).
- To find the local database, use the Electron `userData` path described in [Database](Database.md). A SQLite snapshot does not contain separate files or renderer storage. Use a disposable profile when testing restore or deletion.

## Open in Codex or Antigravity

Open this repository root as the project folder in Codex Desktop or Google Antigravity. In a terminal, start your installed tool from this root. Start a fresh session and ask it to summarize `AGENTS.md`, `docs/CURRENT_STATE.md` and `docs/HANDOFF.md` before modifying files. Google Antigravity’s Customizations area can also show project rules. Both tools document native root `AGENTS.md` discovery. [OpenAI AGENTS.md guide](https://developers.openai.com/codex/guides/agents-md) · [Google Antigravity rules](https://antigravity.google/docs/rules/)

## Troubleshooting

- Missing `window.api` capabilities can indicate a browser mock session or a stale preload/renderer build. Restart dev after edits on the Electron boundary and inspect its console. See [IPC API](API.md).
- Native DB startup errors should be checked against the bundled sql.js WASM location, version and data path. Older scripts refer to unrelated native SQLite tooling and old profile paths.
- For sync pending, check network, the active account, and required cloud schemas and policies. Preserve local work before attempting a snapshot restore.
- For AI errors, check credentials for a hosted model or loopback service status and model availability for local AI. Reproduce with a disposable project when logging content.
