# API Reference (IPC Bridge)

Because **Write Your Thoughts** is an Electron application, the React frontend cannot securely or natively communicate with the local file system or SQLite database. All database interactions must pass through the IPC Bridge exposed to the `window` object.

## The `window.api` Object

The preload script (`app/src/preload/index.ts`) exposes the `window.api` object to the frontend. This is your primary way of fetching and mutating data.

### Example Usage

```typescript
// Fetching all books
const books = await window.api.books.getAll();

// Saving a chapter
const updatedChapter = await window.api.chapters.update(chapterId, {
  content: "<p>New draft content</p>",
  updated_at: new Date().toISOString()
});
```

---

## Namespaces

### `window.api.books`
- `getAll()`: Returns `Promise<Book[]>`
- `getById(id)`: Returns `Promise<Book>`
- `create(data)`: Returns `Promise<Book>`
- `update(id, data)`: Returns `Promise<Book>`
- `delete(id)`: Returns `Promise<boolean>`

### `window.api.chapters`
- `getAll(bookId)`: Returns `Promise<Chapter[]>`
- `getById(id)`: Returns `Promise<Chapter>`
- `create(data)`: Returns `Promise<Chapter>`
- `update(id, data)`: Returns `Promise<Chapter>`
- `delete(id)`: Returns `Promise<boolean>`

### `window.api.characters`
*(Follows standard CRUD pattern)*
- `getAll(bookId)`
- `create(data)`
- `update(id, data)`
- `delete(id)`

### `window.api.locations`, `organizations`, `timeline`, `rules`
*(Follow standard CRUD pattern, scoped by `bookId`)*

### `window.api.sync`
- `triggerManualSync()`: Forces the background sync engine to evaluate the queue.
- `getQueueStatus()`: Returns the number of pending mutations.

---

## Defining New APIs

If you add a new database table (e.g., `magic_spells`), you must:
1. Update the SQLite schema in `main/database/`.
2. Add IPC handlers in `main/ipcHandlers.ts` using `ipcMain.handle()`.
3. Expose the new methods in `preload/index.ts` using `contextBridge`.
4. Add the types to `window.api` in the global declaration file so TypeScript can infer the return types.
