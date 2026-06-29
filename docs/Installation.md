# Installation Guide

This guide will walk you through setting up **Write Your Thoughts** from scratch for local development.

## Prerequisites

Before beginning, ensure you have the following installed on your machine:
- **Git** ([Download](https://git-scm.com/))
- **Node.js** (v18 or higher recommended) ([Download](https://nodejs.org/))
- **npm** (comes bundled with Node.js)
- A [Supabase](https://supabase.com/) account (for database and cloud sync)
- An API Key from OpenAI, Anthropic, or Google Gemini (for AI features)

---

## 1. Clone the Repository

Open your terminal and clone the repository:
```bash
git clone https://github.com/yourusername/write-your-thoughts.git
```

Navigate to the `app` directory, which contains the Electron/React source code:
```bash
cd "write-your-thoughts/app"
```

---

## 2. Install Dependencies

Install all necessary Node packages using npm:
```bash
npm install
```

---

## 3. Configure Environment Variables

The application relies on environment variables to connect to Supabase and configure API settings. 

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` in your text editor and fill in your Supabase project credentials. You can find these in your Supabase Dashboard under **Project Settings -> API**.

   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

---

## 4. Initialize the Database

The local application uses SQLite (`sql.js`), but it synchronizes to a remote PostgreSQL database hosted on Supabase.

1. Go to your Supabase project dashboard.
2. Navigate to the **SQL Editor**.
3. Locate the database schema definition in the project (see [Database Documentation](Database.md)) and execute the SQL scripts to create the necessary tables:
   - `users`
   - `books`
   - `chapters`
   - `characters`
   - `locations`
   - `organizations`
   - `timeline_events`
   - `world_rules`
4. Set up Row Level Security (RLS) policies as defined in the schema to ensure user data remains private.

---

## 5. Start the Development Server

With dependencies installed and the environment configured, start the development server:

```bash
npm run dev
```

This command will:
1. Start the Vite development server for the React frontend.
2. Compile the Electron main process using TypeScript.
3. Launch the Electron application window.

Hot-reloading is enabled, so changes made to the React code will instantly reflect in the app.

---

## 6. Build the Production Version

To package the application for distribution, run:

```bash
npm run build
```

The output will be generated in the `dist/` or `out/` directory, depending on your Electron-Builder configuration.

---

## Platform-Specific Notes

### Windows
- **Execution Policies**: If you encounter errors running `npm` scripts in PowerShell, you may need to bypass the execution policy: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`.
- **Native Modules**: If native dependencies (like `sqlite3`) fail to build, ensure you have Windows Build Tools installed. You can install them by running `npm install --global windows-build-tools` in an administrative terminal.

### macOS
- **Apple Silicon (M1/M2/M3)**: Ensure your Node.js installation is compiled for ARM64 rather than running through Rosetta, as this can cause issues with native Electron modules.
- **Code Signing**: When building for production on macOS, you must configure Apple code signing certificates in your electron-builder config to avoid "unidentified developer" warnings.

### Linux
- **Dependencies**: Building on Linux may require installing specific native libraries. For Debian/Ubuntu, run:
  ```bash
  sudo apt-get install build-essential libssl-dev libx11-dev libxkbfile-dev libsecret-1-dev
  ```

---

## Troubleshooting & Common Errors

**Error: `window.api is undefined`**
- **Cause**: The preload script failed to load or the IPC bridge is incorrectly configured.
- **Fix**: Check `app/src/main/preload.ts` to ensure `contextBridge.exposeInMainWorld` is correctly structured. Restart the `npm run dev` process.

**Error: `Failed to load bindings` (SQLite)**
- **Cause**: The local SQLite engine could not compile or locate its binaries.
- **Fix**: Try rebuilding native modules by running `npm rebuild` or clearing your `node_modules` and reinstalling.

**Sync Fails with 401 Unauthorized**
- **Cause**: Your Supabase `ANON_KEY` or `URL` in `.env` is incorrect, or your auth session expired.
- **Fix**: Double-check your `.env` file and log out/log back in within the app.
