# Write Your Thoughts (v1.0.0)

A desktop-first writing software designed for authors, combining offline reliability with cloud synchronization and intelligent AI assistance. Built with Electron, React, and TypeScript.

![Electron](https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)

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

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/write-your-thoughts.git
   ```

2. Navigate to the `app` directory where the source code lives:
   ```bash
   cd "Write your Thoughts/app"
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. **Environment Setup**:
   Copy the example environment file and fill in your Supabase credentials.
   ```bash
   cp .env.example .env
   ```
   
   Your `.env` should look like this:
   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
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

Detailed documentation about the architecture and specific systems can be found in the `docs/` directory:

- [Write Your Thoughts Overview](docs/Write%20Your%20Thoughts%20Overview.md)
- [Architecture Overview](docs/Write%20Your%20Thoughts%20-%20Architecture.md)
- [Story Intelligence System](docs/STORY_INTELLIGENCE_SYSTEM.md)
- [Database Schema](docs/DATABASE_SCHEMA.md)
- [Sync System](docs/SYNC_SYSTEM.md)
- [Authentication System](docs/AUTH_SYSTEM.md)
- [UI/UX Guidelines](docs/UI_UX.md)
- **[Release Notes](RELEASE_NOTES.md)** - *Changelogs and update history.*
- **[Product Roadmap](ROADMAP.md)** - *Planned future updates including AI Continuity, Visual Timelines, and Export Engine.*

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
