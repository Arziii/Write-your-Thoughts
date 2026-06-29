# Getting Started

Welcome to the development environment for **Write Your Thoughts**! If you haven't installed the project yet, please follow the [Installation Guide](Installation.md) first.

## Application Flow

When you launch the app, you will experience the following workflow:

1. **Authentication**: The app uses Supabase Auth. You must register or log in. 
2. **Dashboard**: The main hub displaying your library of books, your daily writing progress, and quick actions to create new projects.
3. **Workspace**: Selecting a book opens the Workspace, the core interface of the app. It consists of:
   - **Sidebar (Left)**: Navigation for Chapters, Characters, Locations, Relationships, Timeline, Organizations, Codex, Wiki, Notes, and World Rules.
   - **Editor (Center)**: The Tiptap-powered rich text editor where the actual writing happens.
   - **AI Panel (Right)**: The AI assistant panel containing tabs for Brainstorming, Polishing, and History.

## First Steps for Developers

If you are looking to contribute or understand the codebase, here are the most important areas to explore:

1. **The IPC Bridge (`app/src/preload/index.ts` & `app/src/main/ipcHandlers.ts`)**
   Since the app is built on Electron, the React frontend cannot directly access the local SQLite database. It communicates with the Main process using the IPC Bridge defined in the Preload script. Whenever you add a new database table or feature, you will need to add an IPC handler here.

2. **State Management (`app/src/renderer/src/stores/`)**
   The application relies heavily on Zustand for global state. `workspaceStore.ts` manages the currently active book, loaded chapters, and UI state (like text selection and active tabs).

3. **The AI Service (`app/src/renderer/src/services/aiService.ts`)**
   This handles all LLM interactions. It is designed to be provider-agnostic, supporting OpenAI, Gemini, and Claude. It constructs the "Story Intelligence" system prompts and manages the API calls.

## Next Steps

Explore the detailed architecture and specific systems:
- [Architecture Overview](Architecture.md)
- [Folder Structure](Folder-Structure.md)
- [Development Guide](Development-Guide.md)
