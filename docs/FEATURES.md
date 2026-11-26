# Feature inventory

**Implemented** indicates an integrated code path. **Partial** indicates limited coverage or an incomplete workflow. **Planned** refers to proposed follow-up in [Tasks](TASKS.md). Actual test results are recorded in [Testing](TESTING.md).

| Area | Status | Implementation and limits |
| --- | --- | --- |
| Accounts and profiles | Implemented | Supabase registration, verification, reset and cached desktop access. First sign-in needs a configured service. [Data and sync](modules/DATA_AND_SYNC.md) |
| Manuscript | Implemented | Books, chapters, desktop tabs, Tiptap formatting, search and find, word counts, comments, local autosave and version history. [Manuscript and audio](modules/MANUSCRIPT_AND_AUDIO.md) |
| Worldbuilding | Implemented | Characters, portraits, voice profiles, locations, organizations, members, world rules, codex, wiki, notes, relationship graphs, and two timeline views. Rich reference details have local SQLite coverage. [Worldbuilding](modules/WORLDBUILDING.md) |
| Fantasy maps | Implemented | Book atlas, local image import, pins, terrain tools, smart blending, local stamps, forest scatter, labels, terrain-aware roads, rivers, bridges, and styled borders. [Map editor](modules/MAP_EDITOR.md) |
| Writing AI and story review | Implemented with provider setup | Polishing, grounded manuscript Q&A, brainstorming, emotions, style, continuity, character voice, timeline and book-level analysis. [AI and Story Intelligence](modules/AI_AND_STORY_INTELLIGENCE.md) |
| AI Chat and images | Implemented with provider setup | Local conversation history, text models, and local ComfyUI image generation when the runtime and model are available. |
| Narration and exports | Implemented with engine requirements | System voices or Kokoro playback, optional local AI narration preparation, Kokoro chapter WAV export, Markdown, DOCX, EPUB, and PDF. |
| Cloud sync and backup | Partial | Row sync covers selected entities, settings and workspace state. SQLite snapshots have different coverage. Provisioned schema and policies are unverified. |
| Collaboration | Partial | Book publishing, shared book lookup and chapter locks exist. Full invitation management and simultaneous co-editing lack verified end-to-end implementation. |
| Plugins | Partial | Local list/save/delete IPC exists. A supported plugin workflow and isolation model were unverified. |
| Atlas portability, reproducible cloud provisioning and CI | Planned follow-up | See the proposed tasks and issues. |
