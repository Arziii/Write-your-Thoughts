# AI and Story Intelligence

## Providers and request boundaries

[SettingsPage.tsx](../../app/src/renderer/src/pages/settings/SettingsPage.tsx) exposes provider and model settings. [configuration.ts](../../app/src/renderer/src/services/ai/configuration.ts) resolves base URL and model settings, detects local providers and checks configuration. [ProviderFactory.ts](../../app/src/renderer/src/services/ai/ProviderFactory.ts) builds OpenAI, Gemini and Claude adapters, or an OpenAI-compatible adapter for Groq, OpenRouter, Mistral, Together, xAI, Ollama, LM Studio or Custom. Verify model IDs and availability with the configured service. The local path is constrained to loopback and uses [main local AI IPC](../../app/src/main/ipc/localAI.ts) when available. Hosted providers need a connection. [Shared local AI helpers](../../app/src/shared/localAI.ts) define URL constraints.

[aiService.ts](../../app/src/renderer/src/services/aiService.ts) owns the feature prompts and model response parsing. [AIPanel](../../app/src/renderer/src/components/ai/AIPanel.tsx) exposes polishing, brainstorming, and manuscript Q&A. Inputs vary with the tool and can include selection, chapter text or Story Bible context. [manuscriptQuestion.ts](../../app/src/renderer/src/services/manuscriptQuestion.ts) ranks local passages and resolves source quotes. [MessageActions](../../app/src/renderer/src/components/ai/MessageActions.tsx) supports using results in the workspace. Inspect the feature's data scope before changing prompts or routing.

## Analysis

- [StoryIntelligenceView](../../app/src/renderer/src/components/world/StoryIntelligenceView.tsx) exposes book-level analysis, including pacing, chapter statistics, character arcs and emotion. [Story Intelligence IPC](../../app/src/main/ipc/storyIntelligence.ts) persists results in SQLite.
- Editor panels [Continuity](../../app/src/renderer/src/components/editor/ContinuityPanel.tsx), [Emotion](../../app/src/renderer/src/components/editor/EmotionPanel.tsx), [Style](../../app/src/renderer/src/components/editor/StyleIntelligencePanel.tsx), and [Worldbuilding](../../app/src/renderer/src/components/editor/WorldbuildingAnalyzerPanel.tsx) call feature-level analysis. Results are draft guidance. Voice, relationship, location, and timeline workflows are described in [Worldbuilding](WORLDBUILDING.md).

## AI Chat and local images

[ChatStudioPage.tsx](../../app/src/renderer/src/pages/workspace/ChatStudioPage.tsx) is the separate conversation workspace. [chatStudio.ts](../../app/src/renderer/src/services/chatStudio.ts) stores threads and messages in device-local IndexedDB, and calls the configured provider for replies. Per-user image setup is in renderer storage. [studioImages.ts](../../app/src/main/ipc/studioImages.ts) calls a local ComfyUI server for checkpoint listing, generation and cancellation. [studioImageServer.ts](../../app/src/main/ipc/studioImageServer.ts) can start a specific portable Windows install at the default endpoint and tracks the process it owns. A configured model and working local runtime are required. Terrain brush rendering follows the separate procedural and texture path in the [map editor](MAP_EDITOR.md).
