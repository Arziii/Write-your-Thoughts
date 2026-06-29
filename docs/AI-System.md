# AI Integration System

The **Write Your Thoughts** AI system is designed to act as an invisible, intelligent co-author and editor that preserves user intent while strictly adhering to offline-first principles.

## Provider-Agnostic Architecture

The system is designed to be completely provider-agnostic, ensuring users are never locked into a single ecosystem. It natively supports:
- **OpenAI** (gpt-4o, gpt-4o-mini)
- **Anthropic Claude** (claude-3-5-sonnet, claude-3-haiku)
- **Google Gemini** (gemini-1.5-pro, gemini-1.5-flash)

The abstraction layer lives entirely in `app/src/renderer/src/services/aiService.ts`.

## Context Injection & Token Optimization

Unlike basic wrappers that just send raw text to an API, this application employs a **Workspace-Aware** strategy:
1. When a user requests an AI action (e.g., "Brainstorm"), the `AIPanel` gathers the user's `selectedText`, the `currentChapter` content, and the `storyContext` (the overarching book description).
2. The `aiService` constructs a prompt injecting this metadata seamlessly.
3. To optimize token usage, it only requests specific context when needed. For instance, timeline analysis extracts data from the full manuscript, while grammar polishing only sends the highlighted text.

## Core Services

### Polishing Engine
Located in `aiService.polishText`. It supports multiple predefined modes:
- **Grammar**: strictly fixes typos and punctuation.
- **Balanced**: improves prose flow without changing intent.
- **Strong**: active voice enforcement and strong verb swaps.
- **Expand/Shorten**: adjusts pacing.
- **Describe**: sensory detail enhancement.

### Worldbuilding Analyzers
Located in `aiService.analyzeWorldbuilding` and `aiService.analyzeTimelineEvents`.
Instead of generating generic lore, these tools ingest the author's existing notes and check for contradictions, timeline inconsistencies, and missing rules. They return structured JSON payloads to the frontend.

## The Prompts Layer

All system instructions are securely managed within `aiService.ts` to ensure consistency. Future iterations will allow users to define custom global directives.

*See [Story Intelligence](Story-Intelligence.md) for details on the overarching AI philosophy.*
