# The Rich Text Editor

**Write Your Thoughts** features a powerful, headless block-style editor powered by **Tiptap** and **ProseMirror**.

## Editor Philosophy
The editor is designed to emulate standard word processors (Microsoft Word, Google Docs) so that authors experience zero learning curve. It strictly separates the "writing" from the "editing"—the AI cannot type directly into your document; it can only suggest edits in a side panel.

## Implementation Details

### Core Setup (`app/src/renderer/src/components/editor/RichEditor.tsx`)
We use `@tiptap/react` and `@tiptap/starter-kit`.

The editor supports:
- Standard formatting (Bold, Italic, Underline, Strikethrough)
- Headings (H1, H2, H3)
- Blockquotes
- Bulleted & Numbered Lists
- Text Alignment
- Undo / Redo history

### Custom Extensions
In addition to the starter kit, we integrate specific extensions to support writing workflows:
- **Character Count**: Live updating word and character counters.
- **Selection Capture**: A custom listener that updates the `workspaceStore` with the user's currently highlighted text, allowing the AI Panel to instantly grab the selection for brainstorming and polishing.

### Autosave & Persistence
The editor debounces user keystrokes. When typing pauses for 2 seconds, the `RichEditor` component captures the `editor.getHTML()` string and dispatches an update to the database via `window.api.chapters.update()`. This triggers the sync queue transparently.

## Future Editor Enhancements
- **Comment Threads**: Allowing the AI to leave inline margin comments on specific sentences.
- **Focus Mode**: Hiding all toolbars and sidebars to leave only the centered text.
- **Dictation**: Voice-to-text integration that formats dialogue properly.
