# AI Integration System

The **Write Your Thoughts** AI system is designed to act as an invisible, intelligent co-author and editor that preserves user intent while strictly adhering to offline-first principles.

## Provider-Agnostic Architecture

The system is designed to be completely provider-agnostic, ensuring users are never locked into a single ecosystem. It natively supports:

- **OpenAI** (gpt-4o, gpt-4o-mini)
- **Anthropic Claude** (claude-3-5-sonnet, claude-3-haiku)
- **Google Gemini** (gemini-2.5-lite, gemini-2.5-flash)
- **Groq** (llama-3.3-70b-versatile, mixtral-8x7b, etc.)
- **OpenRouter** (Unified API router for hundreds of models)
- **Local / Custom AI** (Ollama, LM Studio, or any OpenAI-compatible endpoint)

The abstraction layer lives entirely in `app/src/renderer/src/services/aiService.ts`.

## Setting Up Your API Key

Before using the AI features, you need to configure your preferred provider and API key within the application:

1. Open the application and go to **Settings** (gear icon in the bottom left).
2. Locate the **AI Configuration** section.
3. Select your desired **AI Provider** from the dropdown menu (e.g., Groq, OpenAI, Anthropic, Gemini, Ollama, etc.).
4. Enter your **API Key** (if the provider requires one).
5. *(Optional)* Click **Show Advanced Settings** to configure specific options like **Model Override** (to manually specify a model string like `llama-3.3-70b-versatile`), Custom Base URLs, Temperature, or Max Tokens.
6. Click **Test Connection** to ensure the app can successfully communicate with your provider.

## Customizable AI Tuning

Every author has a unique voice and specific needs. The AI system offers deep customization via the Advanced Settings panel:

- **AI Style Profile**: Provide custom system instructions (e.g. "Write in a fast-paced, gritty tone. Focus on sensory details") to ensure the AI always matches your exact writing style when editing.
- **Model Override**: Manually enter specific model strings if you want to use a newly released model not yet available in the defaults.
- **Generation Tuning**: Finely adjust the **Temperature**, **Top P**, **Max Tokens**, and **Timeout** to strictly control the AI's creativity, randomness, and response length.
- **Custom Base URLs & Headers**: Easily point the application to your localhost (e.g. `http://localhost:11434/v1`) for 100% private, offline AI capabilities using tools like Ollama or LM Studio.

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
