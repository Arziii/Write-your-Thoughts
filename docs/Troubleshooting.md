# Troubleshooting

Here are common issues you might encounter while installing or running the application, and how to resolve them.

## Blank Screen on App Launch
- **Symptom**: The Electron window opens, but the screen is completely white or black.
- **Cause**: A fatal React render error occurred, or the IPC bridge failed to load.
- **Solution**: Open the Chrome DevTools by pressing `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) and check the Console tab for errors. If it says `window.api is undefined`, your preload script did not compile correctly. Stop the terminal, run `npm run build:preload`, and restart `npm run dev`.

## `sqlite3` Bindings Error
- **Symptom**: Terminal throws an error regarding missing node-sqlite3 bindings.
- **Cause**: The pre-compiled SQLite binaries don't match your architecture (e.g., trying to run x64 binaries on an ARM Mac).
- **Solution**: Run `npm rebuild sqlite3` or delete your `node_modules` folder and run `npm install` again to force a local recompilation.

## Sync Not Working
- **Symptom**: Chapters save locally but never appear on your other devices.
- **Cause**: Invalid Supabase credentials, or the internet connection dropped.
- **Solution**: 
  1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your `.env` file.
  2. Check the console for 401 Unauthorized errors. You may need to log out and log back in to refresh your auth token.

## "window.api.chapters.getAll is not a function"
- **Symptom**: Red error toast appears when opening a book.
- **Cause**: The IPC channel for `chapters.getAll` was not exposed in the preload script.
- **Solution**: Ensure `app/src/preload/index.ts` contains the method definition under `chapters`, and that it forwards to `ipcRenderer.invoke`.

## AI Polish Does Nothing
- **Symptom**: Clicking Brainstorm or Polish hangs forever.
- **Cause**: Missing AI API Key, or the provider is experiencing an outage.
- **Solution**: Check your Settings menu and ensure your API key for OpenAI, Gemini, or Claude is correctly inputted. Check the developer console for network errors.
