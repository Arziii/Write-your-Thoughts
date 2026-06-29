# Development & Contributing Guide

Thank you for your interest in contributing to **Write Your Thoughts**! 

## Philosophy
We treat the code like a good manuscript: it should be readable, well-organized, and structurally sound. We strictly enforce a separation of concerns between UI, State, and Logic.

## Naming & Coding Conventions

- **React Components**: PascalCase (`RichEditor.tsx`, `AIPanel.tsx`). Use standard functional components.
- **Hooks**: camelCase prefixed with `use` (`useAutosave.ts`).
- **Services**: camelCase postfixed with `Service` (`aiService.ts`, `syncService.ts`).
- **Stores**: camelCase postfixed with `Store` (`workspaceStore.ts`).
- **CSS/Tailwind**: We strongly prefer utility classes via TailwindCSS. For complex, reusable composite classes, use `@apply` in `index.css`.

## State Management

We use **Zustand**. 
- **Do**: Create small, focused slices for global state (e.g., `userStore`, `workspaceStore`).
- **Do Not**: Store large documents (like the entire 100k-word manuscript) in Zustand if not needed.
- **Do Not**: Put asynchronous business logic or API calls inside Zustand actions. Services should handle logic, then call `store.setState()` to update the UI.

## Adding a New Feature (Example Workflow)

Imagine you are adding a new feature to track "Vehicles" in the worldbuilding tab.

1. **Database Update**:
   - Add a `vehicles` table to your Supabase PostgreSQL.
   - Add the identical `CREATE TABLE` query to `app/src/main/database/init.ts`.
2. **IPC Bridge**:
   - Create IPC handlers in `app/src/main/ipcHandlers.ts` for CRUD operations on `vehicles`.
   - Expose them in `app/src/preload/index.ts`.
3. **Types**:
   - Define the `Vehicle` interface in `app/src/renderer/src/types/world.ts`.
4. **UI Implementation**:
   - Create a new component `VehicleManager.tsx` in `components/world/`.
   - Fetch the data inside a `useEffect` using `window.api.vehicles.getAll(bookId)`.

## Environment Setup

Ensure you have copied `.env.example` to `.env` and populated it with your Supabase keys.

## Pull Requests

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/awesome-new-tool`).
3. Commit your changes (`git commit -m 'Add awesome new tool'`).
4. Push to the branch (`git push origin feature/awesome-new-tool`).
5. Open a Pull Request outlining your changes and motivation.
