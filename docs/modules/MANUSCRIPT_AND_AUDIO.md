# Manuscript, playback and export

## Editor and saves

[EditorView.tsx](../../app/src/renderer/src/pages/workspace/EditorView.tsx) selects the active view. [RichEditor.tsx](../../app/src/renderer/src/components/editor/RichEditor.tsx) mounts Tiptap and supplies HTML and word count to [useEditorSave.ts](../../app/src/renderer/src/hooks/useEditorSave.ts). The hook stages drafts in Zustand, serializes writes per entity, saves after 10 seconds of inactivity or a 30-second deadline, and flushes on unmount and on explicit save. `flushEditorSaves` also participates in the desktop close flow. [Chapter IPC](../../app/src/main/ipc/chapters.ts) implements `chapters:save`, queues writes, and manages snapshot/milestone save and restoration with compatibility checks for older version columns.

[EditorToolbar.tsx](../../app/src/renderer/src/components/editor/EditorToolbar.tsx), [EditorTabs.tsx](../../app/src/renderer/src/components/editor/EditorTabs.tsx), and [workspaceStore.ts](../../app/src/renderer/src/stores/workspaceStore.ts) implement tool state, book-scoped tab handling, and draft retention. [useOpenBookTab.ts](../../app/src/renderer/src/hooks/useOpenBookTab.ts) coordinates navigation from related views. Find within a chapter uses the editor. Manuscript search uses [SearchModal](../../app/src/renderer/src/components/ui/SearchModal.tsx), [main search](../../app/src/main/ipc/search.ts), and [shared search helpers](../../app/src/shared/manuscriptSearch.ts). Comments use [CommentMark](../../app/src/renderer/src/components/editor/extensions/CommentMark.ts) and [comments IPC](../../app/src/main/ipc/comments.ts).

## Read Aloud

[ReadAloudControls.tsx](../../app/src/renderer/src/components/editor/ReadAloudControls.tsx) speaks selection or chapter content. System speech uses installed local voices through Web Speech. Kokoro plays sequential synthesized passages and prefetches the next clip. [readAloud.ts](../../app/src/renderer/src/services/readAloud.ts) supplies device-local voice/style settings, text chunking, audio cleanup and `prepareNarration`. Optional AI Storytelling sends passages to a supported local provider, caches rewritten text in memory, and leaves stored manuscript HTML untouched. When preparation fails, the playback UI can fall back to reading as written. Windows speech style controls pitch and pace. Kokoro uses its rate and storytelling pacing settings, with phrasing as a separate influence on intonation.

[Main Kokoro IPC](../../app/src/main/ipc/kokoro.ts) validates voice, text and rate, queues native CPU synthesis through sherpa-onnx, and returns mono PCM WAV audio. The model is loaded from app resources at runtime. See [Setup](../SETUP.md).

## Export

[ExportModal.tsx](../../app/src/renderer/src/components/export/ExportModal.tsx) invokes [export IPC](../../app/src/main/ipc/export.ts). The main handler cleans manuscript HTML and saves Markdown through Turndown, DOCX through html-to-docx, EPUB through epub-gen-memory or PDF through Electron print-to-PDF. Formatting options are handled by format. Native dialogs select the destination.

[AudiobookExport.tsx](../../app/src/renderer/src/components/export/AudiobookExport.tsx) offers chapter or book export, Kokoro voice, reading style, and narration mode. It prepares each passage, reports progress, supports cancellation and writes a WAV per completed chapter through a selected folder token. An interrupted export can leave already completed files. Playback and export use shared preparation helpers, while system-voice playback is a separate path. The window close handshake tracks active audiobook jobs through [audiobookExport.ts](../../app/src/renderer/src/services/audiobookExport.ts).
