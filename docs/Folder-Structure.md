# Folder Structure

This document outlines the actual folder architecture of the **Write Your Thoughts** repository, reflecting the latest component-driven approach.

## Root Directory

```text
write-your-thoughts/
├── app/                  # The main Electron & React application source code
├── assets/               # Branding assets, logos, and global project images
├── docs/                 # Documentation (this folder)
├── LICENSE               # MIT License
├── README.md             # Project overview
├── RELEASE_NOTES.md      # Changelog and version history
└── ROADMAP.md            # Upcoming features
```

## `app/` Directory

The core application logic is split into the typical Electron architecture of `main`, `preload`, and `renderer`.

```text
app/
├── src/
│   ├── main/             # Electron Main Process (Node.js backend)
│   │   ├── database/     # SQLite local database initialization & migrations
│   │   ├── index.ts      # App entry point, window management
│   │   └── ipcHandlers.ts# IPC Bridge handlers connecting React to SQLite
│   │
│   ├── preload/          # Electron Preload Scripts
│   │   └── index.ts      # Defines the `window.api` bridge context
│   │
│   ├── renderer/         # React Frontend UI
│   │   ├── src/          # Frontend source code (see detailed breakdown below)
│   │   └── index.html    # Frontend entry HTML
│   │
│   └── shared/           # Types or constants shared between main and renderer
│
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite build configuration
```

## `renderer/src/` Directory (Frontend)

The frontend organizes code by technical layer rather than pure features, enforcing strict separation of concerns.

```text
renderer/src/
├── assets/               # Frontend-specific assets (e.g., placeholder images)
├── components/           # Reusable React components organized by domain
│   ├── ai/               # AI Panel, chat UI, intelligence displays
│   ├── books/            # Book grid, book creation modal
│   ├── chapters/         # Chapter sidebar, organization
│   ├── common/           # Shared UI bits across domains
│   ├── editor/           # Tiptap rich text editor, continuity, style panels
│   ├── export/           # Export modal and pipeline components
│   ├── layout/           # Base layout wrappers (sidebars, app shells)
│   ├── ui/               # Generic primitive components (buttons, modals)
│   └── world/            # Worldbuilding tools (Timeline, Characters, Organizations, etc)
│
├── layouts/              # Top-level page wrappers
├── pages/                # Top-level route components
│   ├── auth/             # Login, Register, Password Reset
│   ├── settings/         # App configuration
│   └── workspace/        # Dashboard, EditorView (The core app workspace)
│
├── services/             # API/Logic layer (No React hooks here)
│   ├── aiService.ts      # LLM orchestration and prompt generation
│   ├── authService.ts    # Supabase authentication wrapper
│   ├── storageService.ts # File uploading/management to cloud
│   └── syncService.ts    # Background synchronization engine
│
├── stores/               # Zustand state managers
│   ├── toastStore.ts     # Global toast notifications
│   ├── userStore.ts      # User preferences and authentication state
│   └── workspaceStore.ts # Core state: active book, active chapter, loaded world lore
│
├── types/                # TypeScript interface definitions (Book, Chapter, etc.)
└── utils/                # Helper functions (date formatting, ID generation)
```

## Architectural Rules
1. **Components** only read from **Stores** or dispatch functions. They do not talk to `window.api` directly unless highly localized.
2. **Services** execute logic and talk to the outside world (AI APIs, Supabase).
3. **IPC Handlers** in `main/` are the only entity that executes local SQLite queries.
