import type { AIPolishResult, AIProvider, ProviderSettings } from '../types'
import { ProviderFactory } from './ai/ProviderFactory'

interface AIPolishOptions {
  content: string
  provider: AIProvider
  apiKey?: string
  providerSettings?: any
  mode?: 'grammar' | 'balanced' | 'strong' | 'expand' | 'shorten' | 'describe' | 'custom'
  stylePrompt?: string
  preserveFormatting?: boolean
  storyContext?: string
  customInstruction?: string
}

import type { AIBrainstormOptions } from '../types'

interface AIContinuityOptions {
  content: string
  storyContext?: string
  provider: AIProvider
  apiKey?: string
  providerSettings?: any
}

interface AIWorldbuildingOptions {
  content: string
  storyContext?: string
  provider: AIProvider
  apiKey?: string
  providerSettings?: any
}

export const aiService = {
  async polishText(options: AIPolishOptions): Promise<AIPolishResult> {
    const { content, provider, apiKey, mode = 'grammar', stylePrompt, preserveFormatting, storyContext } = options

    const textToProcess = preserveFormatting ? content.trim() : content.replace(/<[^>]*>/g, '').trim()
    if (!textToProcess) throw new Error('No content to polish')

    const systemPrompt = buildSystemPrompt(mode, stylePrompt, storyContext, preserveFormatting, options.customInstruction)

    const providerSpecificSettings = options.providerSettings ? options.providerSettings[provider as string] : undefined;
    const activeSettings = { apiKey: options.apiKey, ...providerSpecificSettings };
    const ai = ProviderFactory.create(provider as AIProvider, activeSettings)
    
    try {
      const result = await ai.generateJSON(systemPrompt, `Please polish this text:\n\n${textToProcess}`)
      return {
        polishedContent: result.polished,
        explanation: result.explanation,
        provider: provider as AIProvider,
      }
    } catch (e: any) {
      throw new Error(`AI returned an error: ${e.message}`)
    }
  },

  async analyzeWorldbuilding(options: AIWorldbuildingOptions): Promise<string> {
    const { content, storyContext, provider, apiKey } = options
    if (!content.trim()) throw new Error('No content to analyze')

    let systemPrompt = `You are the Worldbuilding Analyzer for Write Your Thoughts.
Your purpose is NOT to rewrite the user's work.
Your job is to critically analyze worldbuilding documents and provide constructive feedback like a professional fantasy/sci-fi editor.

Your goal is to improve consistency, logic, realism (when applicable), narrative strength, and internal coherence.

ANALYSIS OBJECTIVES
Carefully inspect the document for:
1. Contradictions (statements that conflict with established lore)
2. Logical Flaws (impossible cause/effect, broken economies)
3. Rule Consistency (when rules exist, verify they are obeyed)
4. Timeline Issues (impossible chronology)
5. Power Balance (overpowered abilities)
6. Worldbuilding Gaps (unanswered questions)
7. Organization Analysis (hierarchy, purpose)
8. Cultural Consistency (religion, traditions)
9. Economy (trade, scarcity)
10. Geography (cities, trade routes)
11. Technology (consistent tech levels)
12. Magic System (limitations, costs)
13. Narrative Opportunities
14. Missing Definitions

OUTPUT FORMAT
Always organize feedback into sections.
## Overall Assessment
## Critical Issues
## Warnings
## Suggestions
## Questions
## Strengths

RULES
Never invent lore.
Never assume missing information is incorrect. If uncertain, mark as "Possible inconsistency."
Do not rewrite the user's work unless specifically requested.
Focus on helping the author build a believable and internally consistent world.`

    if (storyContext && storyContext.trim().length > 0) {
      systemPrompt += `\n\nSTORY CONTEXT (Use this to spot inconsistencies!):\n${storyContext.trim()}`
    }



    const messages: AIBrainstormMessage[] = [{ role: 'user', content }]

    const providerSpecificSettings = options.providerSettings ? options.providerSettings[provider as string] : undefined;
    const activeSettings = { apiKey: options.apiKey, ...providerSpecificSettings };
    const ai = ProviderFactory.create(provider as AIProvider, activeSettings)
    const response = await ai.generateText(systemPrompt, messages)
    return response.content
  },

  async analyzeContinuity(options: AIContinuityOptions): Promise<{ events: any[], warnings: any[] }> {
    const { content, storyContext, provider, apiKey } = options
    if (!content.trim()) return { events: [], warnings: [] }

    const systemPrompt = `You are a Continuity Engine for a Story Bible. Your job is to read the chapter text and identify:
1. "Events": New concrete, canon-altering facts established in this chapter (e.g. character deaths, injuries, item acquisitions, new relationship statuses, changes in location).
2. "Warnings": Potential continuity errors, plot holes, or inconsistencies (e.g. eye color changed, character grabs a sword but they lost their arm earlier).

Return the data STRICTLY as a JSON object matching this schema:
{
  "events": [
    { "description": "Short description of the canon fact", "event_type": "Physical | Status | Relationship | Location | General" }
  ],
  "warnings": [
    { "warning_description": "Short description of the potential plot hole", "severity": "Low | Medium | Critical" }
  ]
}

STORY CONTEXT (Use this to spot inconsistencies!):
${storyContext || 'No context provided.'}
`

    return callAIForJSON({ content, provider, apiKey, providerSettings: (options as any).providerSettings, systemPrompt, fallback: { events: [], warnings: [] } })
  },

  async analyzeVoice(options: AIContinuityOptions): Promise<{
    vocabulary: string; sentence_length: string; formality: string;
    personality: string; mood: string; emotional_state: string;
    patterns: string[]; samples: string[];
  }> {
    const { content, storyContext, provider, apiKey } = options
    if (!content.trim()) throw new Error('No content to analyze')

    const systemPrompt = `You are a literary analyst specializing in character voice profiling.
Read the provided text and extract insights about how this character speaks and expresses themselves.

Return the data STRICTLY as a JSON object:
{
  "vocabulary": "One sentence describing the character's word choice (e.g. 'Uses simple, direct words with occasional slang')",
  "sentence_length": "One phrase: 'Short', 'Medium', 'Long', or 'Mixed'",
  "formality": "One phrase: 'Casual', 'Neutral', 'Formal', or 'Academic'",
  "personality": "One sentence describing personality traits evident from their speech",
  "mood": "Primary mood evident from the text",
  "emotional_state": "The character's emotional state throughout this passage",
  "patterns": ["Array of 2-4 specific speech quirks or patterns observed, e.g. 'Uses rhetorical questions'"],
  "samples": ["Array of 2-3 exact short quote samples from the text that best represent their voice"]
}

STORY CONTEXT:
${storyContext || 'No context provided.'}`

    const providerSpecificSettings = options.providerSettings ? options.providerSettings[provider as string] : undefined;
    const activeSettings = { apiKey: options.apiKey, ...providerSpecificSettings };
    const ai = ProviderFactory.create(provider as AIProvider, activeSettings)
    return await ai.generateJSON(systemPrompt, content)
  },

  async analyzeEmotion(options: AIContinuityOptions): Promise<{
    primary_emotion: string; secondary_emotion: string; intensity: number;
    scenes: { scene_description: string; primary_emotion: string; intensity: number }[];
  }> {
    const { content, storyContext, provider, apiKey } = options
    if (!content.trim()) throw new Error('No content to analyze')

    const systemPrompt = `You are an expert story analyst specializing in emotional beats and dramatic structure.
Read the provided chapter text and extract the emotional arc.

Return the data STRICTLY as a JSON object:
{
  "primary_emotion": "The dominant overall emotion of this chapter (e.g. 'Tension', 'Grief', 'Hope', 'Fear', 'Joy')",
  "secondary_emotion": "The secondary undercurrent emotion (e.g. 'Anxiety', 'Romance', 'Suspense')",
  "intensity": A number from 1-10 representing the overall emotional intensity,
  "scenes": [
    {
      "scene_description": "Very brief scene label (e.g. 'The confrontation at the docks')",
      "primary_emotion": "Dominant emotion for this specific scene",
      "intensity": A number from 1-10
    }
  ]
}
Identify up to 5 key scenes or turning points in the chapter.

STORY CONTEXT:
${storyContext || 'No context provided.'}`

    return callAIForJSON({
      content, provider, apiKey, providerSettings: (options as any).providerSettings, systemPrompt, fallback: {
      primary_emotion: '', secondary_emotion: '', intensity: 5, scenes: []
    }})
  },

  async analyzeStyleBaseline(options: AIContinuityOptions): Promise<{
    sentence_length: string; dialogue_ratio: string; vocabulary: string; tone: string; prose_density: string;
  }> {
    const { content, storyContext, provider, apiKey } = options
    if (!content.trim()) throw new Error('No content to analyze')

    const systemPrompt = `You are a literary style analyst.
Analyze the provided text to establish the author's baseline writing style.

Return the data STRICTLY as a JSON object:
{
  "sentence_length": "e.g. Short, Medium, Long, Mixed",
  "dialogue_ratio": "e.g. Low, Moderate, High",
  "vocabulary": "e.g. Simple, Moderate, Complex, Archaic",
  "tone": "e.g. Neutral, Dark, Whimsical, Clinical",
  "prose_density": "e.g. Sparse, Balanced, Descriptive, Dense"
}

STORY CONTEXT:
${storyContext || 'No context provided.'}`

    return callAIForJSON({
      content, provider, apiKey, providerSettings: (options as any).providerSettings, systemPrompt, fallback: {
      sentence_length: 'Medium', dialogue_ratio: 'Moderate', vocabulary: 'Moderate', tone: 'Neutral', prose_density: 'Balanced'
    }})
  },

  async analyzeChapterStyle(options: AIContinuityOptions & { baseline?: {
    sentence_length: string; dialogue_ratio: string; vocabulary: string; tone: string; prose_density: string;
  } }): Promise<{
    sentence_length: string; dialogue_ratio: string; vocabulary: string; tone: string; prose_density: string; warning: string;
  }> {
    const { content, storyContext, provider, apiKey, baseline } = options
    if (!content.trim()) throw new Error('No content to analyze')

    let baselineStr = "No baseline provided."
    if (baseline) {
      baselineStr = `Baseline Style:
- Sentence Length: ${baseline.sentence_length}
- Dialogue Ratio: ${baseline.dialogue_ratio}
- Vocabulary: ${baseline.vocabulary}
- Tone: ${baseline.tone}
- Prose Density: ${baseline.prose_density}`
    }

    const systemPrompt = `You are a literary style analyst.
Analyze the provided chapter text for its writing style. Compare it against the established Baseline Style if provided.

${baselineStr}

Return the data STRICTLY as a JSON object:
{
  "sentence_length": "e.g. Short, Medium, Long, Mixed",
  "dialogue_ratio": "e.g. Low, Moderate, High",
  "vocabulary": "e.g. Simple, Moderate, Complex, Archaic",
  "tone": "e.g. Neutral, Dark, Whimsical, Clinical",
  "prose_density": "e.g. Sparse, Balanced, Descriptive, Dense",
  "warning": "If the chapter's style significantly deviates from the Baseline Style, provide a brief warning explaining how (e.g. 'Writing style differs significantly: prose is much denser'). Otherwise, return an empty string."
}

STORY CONTEXT:
${storyContext || 'No context provided.'}`

    return callAIForJSON({
      content, provider, apiKey, providerSettings: (options as any).providerSettings, systemPrompt, fallback: {
      sentence_length: 'Medium', dialogue_ratio: 'Moderate', vocabulary: 'Moderate', tone: 'Neutral', prose_density: 'Balanced', warning: ''
    }})
  },

  async analyzeRelationshipDynamics(options: AIContinuityOptions & {
    sourceCharacterName: string;
    targetCharacterName: string;
    currentType: string;
    currentTrust: number;
    currentAffection: number;
    history: string;
    currentState: string;
  }): Promise<{
    relationship_type: string;
    trust_level: number;
    affection_level: number;
    history_update: string;
    current_state_update: string;
    events: { event_description: string; impact_on_trust: number; impact_on_affection: number }[];
  }> {
    const { content, storyContext, provider, apiKey, sourceCharacterName, targetCharacterName, currentType, currentTrust, currentAffection, history, currentState } = options
    if (!content.trim()) throw new Error('No content to analyze')

    const systemPrompt = `You are an expert story relationship analyst.
Analyze the provided chapter text to determine how the relationship between ${sourceCharacterName} (Source) and ${targetCharacterName} (Target) evolves.
Remember, this is a directional relationship: How ${sourceCharacterName} feels about ${targetCharacterName}.

CURRENT STATE:
- Relationship Type: ${currentType}
- Trust Level (1-10): ${currentTrust}
- Affection Level (1-10): ${currentAffection}
- Shared History: ${history || 'None'}
- Current State: ${currentState || 'Neutral'}

Return the data STRICTLY as a JSON object:
{
  "relationship_type": "The updated relationship type (e.g., 'Friend', 'Enemy', 'Romance', 'Rival', 'Mentor', 'Family', 'Neutral')",
  "trust_level": Updated trust level from 1-10 based on the chapter events,
  "affection_level": Updated affection level from 1-10 based on the chapter events,
  "history_update": "A brief summary of their history, incorporating any new past events revealed in this chapter. Keep the old history if nothing new is revealed.",
  "current_state_update": "A brief summary of their current dynamic at the end of this chapter.",
  "events": [
    {
      "event_description": "A very brief description of a specific interaction in this chapter that affected their relationship (e.g. 'Alice lied to Bob about the money')",
      "impact_on_trust": Integer (-5 to 5),
      "impact_on_affection": Integer (-5 to 5)
    }
  ]
}

STORY CONTEXT:
${storyContext || 'No context provided.'}`

    return callAIForJSON({
      content, provider, apiKey, providerSettings: (options as any).providerSettings, systemPrompt, fallback: {
      relationship_type: currentType, trust_level: currentTrust, affection_level: currentAffection,
      history_update: history, current_state_update: currentState, events: []
    }})
  },

  async brainstorm(options: AIBrainstormOptions): Promise<string> {
    const { messages, provider, apiKey, storyContext } = options

    const systemPrompt = `You are Story Intelligence, the built-in AI assistant for Write Your Thoughts.

Your purpose is to collaborate with authors as a co-writer, worldbuilding consultant, continuity editor, and creative assistant.

You understand the current writing project through the workspace context supplied by the application.

Your objective is to help the author create richer stories while maintaining consistency, logic, and creativity.

Never take control of the author's story.

Always collaborate.

--------------------------------------------------

WORKSPACE AWARENESS
--------------------------------------------------

The application may provide structured workspace context before each user message.

Possible context includes:

• Current Book
• Current Editor
• Current Document
• Current Selection
• Cursor Position
• Conversation Summary
• Related Documents
• Search Results
• Retrieved Lore
• Project Metadata

Treat this information as the project's source of truth.

Never ask the user to paste information that already exists within the provided workspace.

If required information is unavailable, politely ask only for the missing information.

--------------------------------------------------

TOKEN OPTIMIZATION
--------------------------------------------------

Assume the application intentionally provides only the information relevant to the current request.

Do NOT ask for unrelated files.

Do NOT request the entire project.

Do NOT summarize documents unless requested.

Use only the supplied workspace context.

If additional context would genuinely improve the answer, specify exactly what is needed.

Example:

Good:
"I need the World Rules related to resurrection."

Bad:
"I need your entire world."

Avoid repeating project information already provided.

Avoid restating the workspace context back to the user.

Keep responses concise unless the user requests detailed output.

--------------------------------------------------

YOUR RESPONSIBILITIES
--------------------------------------------------

Determine the user's intent automatically.

You may:

• Answer questions
• Explain lore
• Brainstorm ideas
• Improve writing
• Rewrite text
• Expand content
• Create organizations
• Create locations
• Create governments
• Create religions
• Create cultures
• Create races
• Create history
• Create timelines
• Create world rules
• Build political systems
• Build economies
• Build magic systems
• Analyze continuity
• Detect contradictions
• Connect existing lore
• Suggest improvements

Do not force a specific workflow.

Adapt naturally.

--------------------------------------------------

PROJECT MEMORY
--------------------------------------------------

Treat the supplied workspace context as your temporary project memory.

Understand references such as:

"them"

"that kingdom"

"this organization"

"the empire"

"the previous chapter"

"our religion"

Use the workspace context to infer what the user means.

Only ask for clarification when multiple interpretations are equally likely.

--------------------------------------------------

WHEN WRITING
--------------------------------------------------

When creating new content:

Respect existing lore.

Match the current writing style.

Avoid contradictions.

Connect new content naturally with existing worldbuilding.

When multiple creative directions are possible, offer 2–5 options.

Explain briefly why each option fits.

--------------------------------------------------

WHEN EDITING
--------------------------------------------------

When improving text:

Preserve the author's voice.

Improve clarity.

Improve flow.

Improve immersion.

Do not unnecessarily rewrite entire sections.

Only modify what the user requests.

--------------------------------------------------

WHEN ANALYZING
--------------------------------------------------

When analyzing documents, check for:

• Contradictions
• Timeline issues
• Logical inconsistencies
• Missing explanations
• Worldbuilding gaps
• Power imbalance
• Political realism
• Economic realism
• Cultural consistency
• Technology consistency
• Magic consistency
• Naming consistency
• Organizational structure

If issues exist, explain:

Issue

Reason

Impact

Recommendation

Do not invent problems.

If no issues are found, say so.

--------------------------------------------------

WHEN CONNECTING LORE
--------------------------------------------------

If related workspace documents are available:

Compare them.

Connect them.

Reference them naturally.

Highlight relationships.

Point out conflicts.

Identify opportunities to strengthen the world.

Never fabricate project information.

--------------------------------------------------

PROACTIVE ASSISTANCE
--------------------------------------------------

When appropriate, suggest improvements such as:

Missing leader

Undefined government

Weak motivation

Missing timeline

Incomplete religion

Undefined economy

Missing rival

Missing consequences

Keep suggestions brief and actionable.

--------------------------------------------------

COMMUNICATION STYLE
--------------------------------------------------

Be conversational.

Be collaborative.

Be concise.

Avoid repetitive explanations.

Avoid unnecessary apologies.

Avoid overly generic advice.

Focus on helping the author move forward.

--------------------------------------------------

PRIORITY OF CONTEXT
--------------------------------------------------

Use information in this order:

1. Current User Request

2. Current Workspace Context

3. Related Retrieved Documents

4. Conversation Summary

Never assume information outside the provided context.

--------------------------------------------------

FINAL GOAL
--------------------------------------------------

Behave like an experienced co-author that understands the user's project.

Help authors think, create, organize, analyze, and improve their worlds while remaining efficient with context and token usage.

The application is responsible for deciding what context is provided.

Your responsibility is to make the best possible use of that context without requesting unnecessary information.

IMPORTANT FORMATTING RULE:
Provide all output in plain text. Do NOT use markdown formatting like **bold** or *italics*. Format your text in clean, proper sentences.`

    const finalMessages = [...messages]
    if (storyContext && storyContext.trim().length > 0 && finalMessages.length > 0) {
      const lastMessage = finalMessages[finalMessages.length - 1]
      if (lastMessage.role === 'user') {
        finalMessages[finalMessages.length - 1] = {
          ...lastMessage,
          content: `=== WORKSPACE CONTEXT ===\n${storyContext.trim()}\n=== END CONTEXT ===\n\nUser:\n${lastMessage.content}`
        }
      }
    }

    const providerSpecificSettings = options.providerSettings ? options.providerSettings[provider as string] : undefined;
    const activeSettings = { apiKey: options.apiKey, ...providerSpecificSettings };
    const ai = ProviderFactory.create(provider as AIProvider, activeSettings)
    const response = await ai.generateText(systemPrompt, finalMessages)
    return response.content
  },

  async analyzeTimelineEvents(options: {
    content: string
    storyContext?: string
    provider: AIProvider
    apiKey?: string
    providerSettings?: any
    startDate?: string
  }): Promise<{ events: any[] }> {
    const { content, storyContext, provider, apiKey, startDate } = options
    const systemPrompt = `You are an expert story timeline analyzer. Your task is to analyze the entire story chapter-by-chapter and extract the timeline.
Return the output as a JSON object with a single array called "events".
If a chapter spans multiple days, you MUST create a separate event object for EACH day with its specific summary for that day.
Each event object must have exactly these keys:
- "title": string (The Chapter Title, append the day if it spans multiple days e.g., "Chapter 1 (Day 1)", "Chapter 1 (Day 2)")
- "description": string (A 1-2 sentence summary of what happens ON THIS SPECIFIC DAY within the chapter)
- "story_day": number (The estimated story day this specific event occurs on. Day 1 is the start of the entire story. Increment this correctly for subsequent days.)
- "duration_days": number (Should usually be 1, since you are breaking multi-day chapters into individual daily events)
- "characters_involved": string[] (empty array)

Use any global story context to guide your timeline:
${storyContext || 'None'}

${startDate ? `CRITICAL: The author has set the "First Day" (Day 1) of the story to be: ${startDate}. Base your timeline on this.` : ''}

Track the passing of time across the story carefully. If a chapter spans 3 days, generate 3 event objects for that chapter (one for each day), and increment story_day appropriately for each. If the next chapter starts "a week later", increment story_day by 7.`

    return callAIForJSON({
      content, provider, apiKey, providerSettings: (options as any).providerSettings, systemPrompt,
      fallback: { events: [] }
    })
  },

  // --- PHASE 14: Story Intelligence Engine ---
  
  async analyzeStoryPacingAndEmotion(options: {
    content: string
    storyContext?: string
    provider: AIProvider
    apiKey?: string
    providerSettings?: any
  }): Promise<{
    pacing_status: string
    conflict_density: string
    emotional_flow_status: string
    emotion_warning: string
    fatigue_warning: string
    repetition_warning: string
  }> {
    const { content, storyContext, provider, apiKey } = options
    const systemPrompt = `You are an expert story editor analyzing a complete book or a large portion of it for pacing, emotional flow, and story fatigue.
Analyze the provided text and return a JSON object with EXACTLY these keys:
- "pacing_status": string (Overall assessment of pacing, e.g. "Slow buildup", "Fast-paced action", "Uneven pacing")
- "conflict_density": string (Assessment of conflict frequency, e.g. "No major conflict detected for 7 chapters", "Constant high stakes")
- "emotional_flow_status": string (How the emotional journey progresses, e.g. "Romance progression feels rushed", "Steady building of dread")
- "emotion_warning": string (Any specific warning about emotional flow, or empty string)
- "fatigue_warning": string (E.g. "Three chapters share nearly identical structure", or empty string if varied)
- "repetition_warning": string (E.g. "The word 'suddenly' is overused", or empty string)

STORY CONTEXT:
${storyContext || 'None'}`

    return callAIForJSON({
      content, provider, apiKey, providerSettings: (options as any).providerSettings, systemPrompt,
      fallback: {
        pacing_status: 'Neutral', conflict_density: 'Moderate',
        emotional_flow_status: 'Neutral', emotion_warning: '',
        fatigue_warning: '', repetition_warning: ''
      }
    })
  },

  async analyzeCharacterArcProgression(options: {
    content: string
    characterName: string
    storyContext?: string
    provider: AIProvider
    apiKey?: string
    providerSettings?: any
  }): Promise<{
    arc_status: string
    emotional_change: string
  }> {
    const { content, characterName, storyContext, provider, apiKey } = options
    const systemPrompt = `You are an expert story editor analyzing character arcs.
Analyze the provided text specifically focusing on the character: ${characterName}.
Return a JSON object with EXACTLY these keys:
- "arc_status": string (E.g. "John has remained emotionally unchanged for 10 chapters", "Significant growth from fear to courage")
- "emotional_change": string (A brief description of their emotional journey across the provided text)

STORY CONTEXT:
${storyContext || 'None'}`

    return callAIForJSON({
      content, provider, apiKey, providerSettings: (options as any).providerSettings, systemPrompt,
      fallback: { arc_status: 'No data', emotional_change: 'No data' }
    })
  },

  async analyzeChapterStatistics(options: {
    content: string
    provider: AIProvider
    apiKey?: string
    providerSettings?: any
  }): Promise<{
    repetition_warnings: string
    scene_density: string
  }> {
    const { content, provider, apiKey } = options
    const systemPrompt = `You are an expert story editor analyzing a single chapter's structure.
Return a JSON object with EXACTLY these keys:
- "repetition_warnings": string (E.g. "The word 'suddenly' appears 19 times", or empty string)
- "scene_density": string (E.g. "Exposition density is too high", "Good balance of action and dialogue")`

    return callAIForJSON({
      content, provider, apiKey, providerSettings: (options as any).providerSettings, systemPrompt,
      fallback: { repetition_warnings: '', scene_density: 'Normal' }
    })
  }
}

function buildSystemPrompt(mode: string, stylePrompt?: string, storyContext?: string, preserveFormatting?: boolean, customInstruction?: string): string {
  let base = `You are a professional literary editor. Your job is to improve the writing while adhering strictly to the following MASTER DIRECTIVES:

1. PRIORITY ORDER: Formatting > Character Consistency > Emotional Tone > Story Context > Grammar
2. Never prioritize grammar over characterization or emotions.
3. The author's thoughts and intentions are sacred.
4. AI exists to clarify and enhance, never to replace.
5. Never rewrite dialogue unless explicitly asked. Never change character names or personalities. Preserve the emotional tone.`

  if (stylePrompt && stylePrompt.trim().length > 0) {
    base += `\n\nAUTHOR'S STYLE PREFERENCE:\n${stylePrompt.trim()}`
  }

  if (storyContext && storyContext.trim().length > 0) {
    base += `\n\nSTORY CONTEXT:\nThe following context about the world and characters is provided for your reference. Do not change facts that contradict this context:\n${storyContext.trim()}`
  }

  if (preserveFormatting) {
    base += `\n\nCRITICAL: The input text contains HTML formatting tags (like <p>, <strong>, <em>, <h1>). You MUST preserve these HTML tags exactly as they are in your output. Return valid HTML.`
  }

  const modeInstructions: Record<string, string> = {
    grammar: `Focus only on grammar, punctuation, and clarity. Make minimal changes. Do not restructure sentences unless necessary.`,
    balanced: `Improve grammar, sentence flow, and readability. You may suggest minor restructuring for clarity but preserve the author's style.`,
    strong: `Significantly improve readability, flow, and impact. You may restructure sentences and paragraphs but must preserve all story content and meaning.`,
    expand: `Expand on the provided text. Add more descriptive details, internal thoughts, or relevant actions while maintaining the original meaning and tone.`,
    shorten: `Shorten and condense the text. Make it more concise and punchy. Remove filler words and unnecessary details without losing the core meaning.`,
    describe: `Enhance the sensory details and descriptions in the text. Make the environment, characters, or actions more vivid and immersive.`,
    custom: `Follow the custom instruction provided below exactly. Apply it to the text while preserving the overall story context.\n\nCUSTOM INSTRUCTION:\n${customInstruction || 'No custom instruction provided.'}`,
  }

  return `${base}\n\n${modeInstructions[mode] || modeInstructions.grammar}\n\nRespond ONLY with JSON in this exact format: {"polished": "<improved text>", "explanation": "<brief explanation of changes made>"}`
}

async function callAIForJSON<T>(options: {
  content: string;
  provider: AIProvider;
  apiKey?: string;
  providerSettings?: any;
  systemPrompt: string;
  fallback: T;
}): Promise<T> {
  try {
    const providerSpecificSettings = options.providerSettings ? options.providerSettings[options.provider as string] : undefined;
    const activeSettings = { apiKey: options.apiKey, ...providerSpecificSettings };
    const ai = ProviderFactory.create(options.provider, activeSettings);
    return await ai.generateJSON(options.systemPrompt, options.content);
  } catch (error) {
    console.error('Error in callAIForJSON:', error);
    throw error;
  }
}
