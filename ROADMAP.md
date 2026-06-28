# Write Your Thoughts - Product Roadmap

This document outlines the planned future major updates for the application. The foundational core (offline-first text editing, Supabase cloud sync, state preservation, and version history) is fully complete. The following features represent the evolution from a robust text editor to an intelligent "co-author" platform.

---

## 1. The Publishing & Export Engine (v2.1.0 Priority)

To complete the core lifecycle of a book (Idea → Writing → Publishing), the app requires a robust export system.

**Planned Features:**

- **One-Click Compilation:** Automatically stitch all chapters in a book into a single cohesive document.
- **Dynamic Table of Contents:** Generate a clickable TOC based on chapter titles and structure.
- **Advanced Formatting:** Apply global typography and layout settings (margins, fonts, chapter headers).
- **Multiple Formats:** Export directly to:
  - `.epub` (Ready for Amazon Kindle, Apple Books, Kobo)
  - `.pdf` (For print-ready physical copies or sharing)
  - `.docx` (For traditional publisher/editor submissions)
  - `.md` (Raw markdown for data portability)

---

## 2. AI Continuity & Story Bible Engine (v2.2.0)

Leveraging the existing `continuity_warnings` and `chapter_emotions` database schemas, the app will integrate with LLMs (OpenAI/Anthropic/Gemini) to act as a proactive editorial assistant.

**Planned Features:**

- **Context-Aware Consistency Checking:** The AI scans newly written text against the user's Character profiles, Codex entries, and Lore. If a character's physical description or timeline conflicts with established lore (e.g., "John's eyes are blue" vs "green"), the app flags a non-intrusive continuity warning.
- **Emotional Arc Tracking:** Automatic analysis of scene sentiment to map the emotional peaks and valleys of a chapter.
- **Interactive Story Bible:** A chat interface where the author can query their own lore ("When did the protagonist first meet the antagonist?").

---

## 3. Visual Timeline & World Builder (v2.3.0)

Expanding on the `timeline_settings` and `verse_timeline_events` schemas, this feature provides a spatial and chronological view of the author's universe.

**Planned Features:**

- **Drag-and-Drop Timeline UI:** A beautiful horizontal canvas to plot historical lore events and chapter scenes.
- **Custom Calendar Systems:** Support for standard Gregorian calendars or completely custom fantasy calendar systems (custom months, days in a year).
- **Character Lifespans:** Visualize which characters are alive, present, or overlapping during specific historical eras or chapters.
- **Conflict Highlighting:** Automatically detect if a chapter is placed at a date before a required prerequisite event occurs.
