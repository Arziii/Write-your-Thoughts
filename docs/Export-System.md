# Export System

Once a manuscript is ready, authors can compile their separate chapters into a single readable format.

## Overview

The Export pipeline aggregates all chapters within a Book, sorts them by `chapter_order`, and compiles them into a chosen format. 

## Supported Formats

### 1. Markdown (.md)
- **Use Case**: Best for archiving or transferring to other plain-text editors like Obsidian.
- **Implementation**: We convert the Tiptap HTML content into Markdown syntax. It combines all chapters with standard `## Chapter Title` headers.

### 2. PDF & DOCX (Work in Progress)
- **Use Case**: Submitting to publishers or beta readers.
- **Implementation (Planned)**: Will utilize libraries like `html-pdf-node` or `docx` to generate formatted binary files directly from the desktop client.

### 3. EPUB (Work in Progress)
- **Use Case**: Direct publishing to e-readers (Kindle, Apple Books).
- **Implementation (Planned)**: Will bundle chapters into XHTML documents, generate an NCX/NAV Table of Contents, and compress it into a valid `.epub` zip archive.

## UI Workflow

1. The user clicks **Export** from the Dashboard or Workspace.
2. An Export Modal appears allowing the selection of formats.
3. Upon confirmation, the Main process streams the chapters from SQLite, performs the necessary conversion, and opens a native OS "Save As" dialog using `dialog.showSaveDialog`.
