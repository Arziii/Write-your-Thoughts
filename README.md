# Write Your Thoughts (Beta v1)

<p align="center">
  <img src="assets/logo-placeholder.png" alt="Write Your Thoughts Logo" width="200" height="200" />
</p>

<p align="center">
  <em>A desktop-first writing software designed for authors, combining offline reliability with cloud synchronization and intelligent AI assistance. Built with Electron, React, and TypeScript.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" />
  <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" />
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white" />
</p>

---

## 📖 Overview

Write Your Thoughts is a comprehensive workspace tailored specifically for novel writers and worldbuilders. It provides a distraction-free writing environment that operates completely offline, while seamlessly syncing your data securely to the cloud via Supabase. It incorporates "Story Intelligence," a contextual AI that understands your world's lore, characters, and rules to assist you in writing.

## ✨ Features

- **Desktop-First Experience**: Lightning-fast local SQLite database. Works completely offline.
- **Story Intelligence System**: Keep track of characters, locations, organizations, and world rules with smart AI cross-referencing.
- **Rich Text Editor**: Powerful block-style editor built on Tiptap.
- **Cloud Synchronization**: Background sync engine resolving conflicts and preserving offline changes.
- **AI-Assisted Editing**: Context-aware AI to brainstorm, check grammar, analyze continuity, and develop story arcs.
- **Export Options**: Export your work to multiple formats including EPUB, DOCX, and Markdown.

## 📸 Screenshots

*(Add screenshots here)*

- Dashboard View
- Rich Editor & AI Panel
- Worldbuilding (Characters/Locations)
- Timeline Analyzer

## 🚀 Technology Stack

- **Framework**: [Electron](https://www.electronjs.org/) + [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Editor Core**: [Tiptap](https://tiptap.dev/)
- **Database/Auth**: [Supabase](https://supabase.com/) & local SQLite (`sql.js`)
- **AI Integration**: OpenAI / Anthropic / Google Gemini support

---

## 🏗️ Architecture Overview

The application follows an **Offline-First Multi-Process Architecture**:

1. **Renderer Process (React)**: Handles the UI, state (Zustand), and Tiptap editor.
2. **Main Process (Electron)**: Manages local SQLite storage and secure IPC bridge.
3. **Sync Engine (Background)**: Synchronizes local SQLite changes to Supabase when online.

For more details, see [Architecture Documentation](docs/Architecture.md).

## 📂 Folder Structure

```
write-your-thoughts/
├── app/
│   ├── src/
│   │   ├── main/          # Electron Main Process & SQLite Setup
│   │   ├── preload/       # IPC Bridge exposing APIs to Renderer
│   │   └── renderer/      # React Frontend (UI, State, Services)
│   ├── build/             # Electron packaging assets
│   ├── tailwind.config.js # Styling configuration
│   └── vite.config.ts     # Build configuration
└── docs/                  # Project Documentation
```

For more details, see [Folder Structure Documentation](docs/Folder-Structure.md).

---

## 🛠️ Installation Guide

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A Supabase project for cloud sync (optional if strictly offline)
- AI API Key (OpenAI, Gemini, or Claude)

### Step 1: Clone the repository

```bash
git clone https://github.com/yourusername/write-your-thoughts.git
cd write-your-thoughts/app
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Environment Setup

Copy the example environment file and fill in your credentials.

```bash
cp .env.example .env
```

Ensure your `.env` contains:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 4: Database Setup (Supabase)

Run the migration scripts located in your Supabase dashboard to set up the remote schema matching the local SQLite structure. See [Database Documentation](docs/Database.md).

### Step 5: AI Integration Setup

To use the powerful AI features (Story Intelligence, Grammar Polish, Brainstorming), you must configure your API key inside the app:

1. Launch the application (`npm run dev`).
2. Navigate to **Settings** (gear icon in the bottom left).
3. Under the **AI Configuration** section:
   - Select your preferred **AI Provider** (e.g., Groq, OpenAI, Anthropic, Gemini, Ollama, etc.).
   - Enter your **API Key** (if required by the provider).
   - (Optional) Click **Show Advanced Settings** to configure a specific **Model Override**, Temperature, or Custom Base URL.
4. Click **Test Connection** to verify your key is working correctly.

---

## 💻 Running the Project

### Development Mode

Start the application in development mode with hot-reloading:

```bash
npm run dev
```

### Production Build

To build the application executable for your current operating system:

```bash
npm run build
```

---

## 🧠 AI Features & Capabilities

Write Your Thoughts integrates a sophisticated **Story Intelligence** system:

- **Workspace-Aware AI**: The AI panel dynamically reads your current book, chapter, selected text, and world lore to provide hyper-relevant advice.
- **Lore Analyzers**: Automatically generate timelines, flag lore contradictions, and analyze character relationships based on your manuscript.
- **Continuity Engine**: Track baseline writing style and warn the author if a new chapter deviates dramatically from established tones.

For more details, see [AI System Documentation](docs/AI-System.md).

---

## 🗺️ Roadmap & Known Limitations

**Roadmap:**

- Cloud conflict-resolution UI
- Comprehensive Export Engine (PDF, native EPUB)
- Voice Intelligence (Dictation with live formatting)
- Collaborative Editing

**Known Limitations:**

- Syncing large manuscript conflicts requires manual resolution occasionally.
- Native spellcheck requires OS-level dictionaries.

---

## 🤝 Contributing

We welcome contributions! Please see our [Development Guide](docs/Development-Guide.md) for details on our coding conventions, testing procedures, and submission guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Credits

Built by authors, for authors. Powered by the open-source community.
