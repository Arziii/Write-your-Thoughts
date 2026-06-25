# Write Your Thoughts

![Write Your Thoughts Screenshot](./assets/Screenshot.png)

A desktop-first writing software designed for authors, combining offline reliability with cloud synchronization and intelligent AI assistance. Built with Electron, React, and TypeScript.

## Features

- **Desktop-First Experience**: Works completely offline with a fast, responsive interface.
- **Cloud Synchronization**: Seamlessly syncs your manuscripts, characters, and settings across devices using Supabase.
- **AI-Assisted Editing**: Context-aware AI to help with brainstorming, grammar checking, and story development.
- **Rich Text Editor**: Powerful and customizable block-style editor built on Tiptap.
- **Story Intelligence System**: Keep track of characters, locations, and lore elements with smart cross-referencing.
- **Export Options**: Export your work to multiple formats including EPUB, DOCX, and Markdown.

## Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/) + [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Editor**: [Tiptap](https://tiptap.dev/)
- **Database/Auth/Sync**: [Supabase](https://supabase.com/) & local SQLite (`sql.js`)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (comes with Node.js)
- A Supabase project for cloud sync (optional for offline-only use)

### Installation

1. Clone the repository or download the source code.
2. Navigate to the `app` directory where the source code lives:
   ```bash
   cd app
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

To start the application in development mode with hot-reloading:

```bash
npm run dev
```

### Building for Production

To build the application executable for your current operating system:

```bash
npm run build
```

## Documentation

Detailed documentation about the architecture and specific systems can be found in the root directory:

- [Write Your Thoughts Overview](Write%20Your%20Thoughts%20Overview.md)
- [Architecture Overview](Write%20Your%20Thoughts%20-%20Architecture.md)
- [Story Intelligence System](STORY_INTELLIGENCE_SYSTEM.md)
- [Database Schema](DATABASE_SCHEMA.md)
- [Sync System](SYNC_SYSTEM.md)
- [Authentication System](AUTH_SYSTEM.md)
- [UI/UX Guidelines](UI_UX.md)

## License

[Add License Information Here]
