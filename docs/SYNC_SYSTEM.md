# Write Your Thoughts - Cloud Synchronization Architecture

The application is built on a **Local-First, Offline-Capable** philosophy. Users should be able to continue writing without an internet connection, without experiencing UI freezing or loading spinners.

Synchronization occurs automatically in the background via a sophisticated 5-Phase architecture bridging the local SQLite database and the Supabase Cloud.

---

## The 5-Phase Architecture

### Phase 1: Granular Sync Engine (Local → Cloud)
- **The Sync Queue:** Every mutating database operation (Create, Update, Delete) writes an entry to a local `sync_queue` table in SQLite.
- **Background Processing:** The `syncService.ts` continuously monitors this queue. If there is an active internet connection, it pushes the changes to Supabase in batches.
- **Resilience:** If the user goes offline, changes pool safely in the queue. When they reconnect, the queue seamlessly empties to the cloud.

### Phase 2: Asset Synchronization
- **Binary Data:** Images, Book Covers, and Character Portraits are never stored as Base64 strings in the database.
- **Supabase Storage:** Files are written to the local filesystem first. In the background, they are uploaded to a Supabase Storage bucket, and a `cloud_url` is returned and saved.

### Phase 3: Multi-Device Support (Cloud → Local)
- **Initial Pull:** Upon app launch, the system checks the `updated_at` timestamps of local tables and pulls any newer records from the cloud to update the local SQLite database.
- **Realtime Websockets:** The app uses Supabase Realtime Channels. When an edit is made on Device A, Device B receives a WebSocket payload and silently merges the update into its local database, triggering a UI refresh.

### Phase 4: Workspace State Sync
- **State Preservation:** The `cloud_workspace_state` table keeps track of open tabs, the currently active chapter, sidebar state, and cursor positions.
- **Seamless Handoff:** Moving from a desktop computer to a laptop restores the exact working environment automatically.

### Phase 5: Dual-Layer Version History
- **Layer 1: Granular Autosaves (Local-Only):** The app saves local snapshots of the active chapter every 15 minutes of continuous writing. These are kept strictly local to avoid cloud storage bloat.
- **Layer 2: Cloud Milestones (Synced):** Users can explicitly save "Milestones" (e.g., "Draft 1 Complete"). These are logged in SQLite and immediately pushed to the `cloud_chapter_versions` table via the Sync Queue.
- **Version Restoration:** The Version History UI allows users to browse and safely restore text from either local autosaves or cloud milestones.

---

## Conflict Resolution

- **Rule:** The newest timestamp wins (`updated_at`).
- **Strategy:** In a single-user architecture, conflict resolution heavily favors the most recent write.
- **Milestone Backup:** Before any destructive overwrite from the cloud occurs, a local "auto" snapshot is captured in the version history, guaranteeing that no local draft is ever permanently lost.

## Offline Mode Capabilities

| Feature | Offline | Online |
| :--- | :---: | :---: |
| **Writing & Editing** | ✅ | ✅ |
| **Local Autosave (3s)** | ✅ | ✅ |
| **15-Min Version Snapshots**| ✅ | ✅ |
| **Cloud Milestones** | ❌ (Queued) | ✅ |
| **Cross-Device Sync** | ❌ (Paused)| ✅ |
| **AI Assistants** | ❌ | ✅ |
