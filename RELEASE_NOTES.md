# Write Your Thoughts - Release Notes

## v2.0.0 (The Stability & Synchronization Update)

Welcome to Write Your Thoughts v2.0.0! This major release focuses entirely on deeply hardening the application's architecture, fixing edge-case race conditions, solidifying the offline-to-cloud synchronization pipeline, and greatly improving the authentication experience. 

The system is now production-ready, featuring a bulletproof data layer that seamlessly transitions between local SQLite and Supabase cloud storage without flickering or data loss.

### 🚀 Major Improvements

* **Intelligent Cloud Synchronization:** The login process now intelligently compares your local SQLite database timestamps against the cloud backup. It will only perform an automatic full database restore if the cloud backup is strictly newer, preserving your local offline edits.
* **Unified Loading Experience:** Eliminated UI flickering and double-loading screens during login. The cloud-pull operations now happen seamlessly in the background while the login button indicates progress, dropping you straight into a fully hydrated workspace.
* **Hardened Authentication Flows:** 
  * Full support for Deep Linking (`wyt://auth/reset-password`).
  * Added complete, polished UI flows for Forgot Password and Reset Password functionality.
* **React Strict Mode Resilience:** Migrated critical authentication flags (`isFreshLogin`) from volatile browser `sessionStorage` into the centralized React memory store (`useUserStore`). This prevents React's development strict-mode from accidentally double-mounting components and improperly navigating users to cached chapters after a manual sign-in.

### 🐛 Bug Fixes

* **Auth/Sync Race Condition:** Fixed a critical race condition where Supabase's `onAuthStateChange` would fire and attempt to sync the database before `signInWithPassword` finished storing the user's profile locally, causing random login lockups or incorrect routing.
* **Dashboard Cover Uploads:** Resolved a `400 Bad Request` error when uploading custom Dashboard Covers. The browser was severing the `File` object from memory because the `<input>` element was being cleared before the Supabase upload stream completed.
* **Title Bar Branding:** The application's window Title Bar now correctly respects the React Router path. It will cleanly display the "Write Your Thoughts" branding when viewing the Dashboard, ignoring any stale cached book titles.
* **Login Redirection:** Fixed a bug where signing out and signing back in manually would instantly drop the user back into their previously opened chapter instead of the Dashboard.

### 🛠 Technical Changes

* Optimized `authService.ts` and `App.tsx` interaction to prioritize SQLite profile hydration before PostgreSQL realtime subscriptions attach.
* Updated Electron builder configurations to ensure `wyt://` deep linking binds correctly on Windows operating systems.
* Simplified file input handlers across Dashboard components to rely on controlled React state rather than direct DOM manipulation.
