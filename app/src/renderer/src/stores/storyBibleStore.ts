import { create } from 'zustand'
import type { 
  StoryBible, CharacterProfile, LocationProfile, OrganizationProfile, LoreEntry,
  CharacterVoiceProfile, SpeechPattern, DialogueSample,
  ChapterEmotion, SceneEmotion, ContinuityEvent, ContinuityWarning,
  StyleProfile, ChapterMetric,
  Relationship, RelationshipEvent, RelationshipState,
  TimelineSettings, TimelineEvent
} from '../types'

interface StoryBibleStore {
  // Global Story Bible Context
  storyBible: StoryBible | null
  setStoryBible: (bible: StoryBible | null) => void
  updateStoryBible: (bible: StoryBible) => void

  // Character Profiles (AI Generated)
  characterProfiles: Record<string, CharacterProfile> // Key is character_id
  setCharacterProfiles: (profiles: CharacterProfile[]) => void
  updateCharacterProfile: (profile: CharacterProfile) => void

  // Location Profiles
  locationProfiles: Record<string, LocationProfile>
  setLocationProfiles: (profiles: LocationProfile[]) => void
  updateLocationProfile: (profile: LocationProfile) => void

  // Organization Profiles
  organizationProfiles: Record<string, OrganizationProfile>
  setOrganizationProfiles: (profiles: OrganizationProfile[]) => void
  updateOrganizationProfile: (profile: OrganizationProfile) => void

  // Lore Entries
  loreEntries: Record<string, LoreEntry>
  setLoreEntries: (entries: LoreEntry[]) => void
  updateLoreEntry: (entry: LoreEntry) => void

  // Character Voice Profiles
  voiceProfiles: Record<string, CharacterVoiceProfile> // Key is character_id
  setVoiceProfiles: (profiles: CharacterVoiceProfile[]) => void
  updateVoiceProfile: (profile: CharacterVoiceProfile) => void

  // Speech Patterns
  speechPatterns: Record<string, SpeechPattern[]> // Key is character_id
  setSpeechPatterns: (characterId: string, patterns: SpeechPattern[]) => void
  addSpeechPattern: (pattern: SpeechPattern) => void
  removeSpeechPattern: (characterId: string, id: string) => void

  // Dialogue Samples
  dialogueSamples: Record<string, DialogueSample[]> // Key is character_id
  setDialogueSamples: (characterId: string, samples: DialogueSample[]) => void
  addDialogueSample: (sample: DialogueSample) => void
  removeDialogueSample: (characterId: string, id: string) => void

  // --- Phase 9: Emotional Intelligence ---
  chapterEmotions: Record<string, ChapterEmotion> // Key is chapter_id
  setChapterEmotions: (emotions: ChapterEmotion[]) => void
  updateChapterEmotion: (emotion: ChapterEmotion) => void

  sceneEmotions: Record<string, SceneEmotion[]> // Key is chapter_id
  setSceneEmotions: (chapterId: string, emotions: SceneEmotion[]) => void
  addSceneEmotion: (emotion: SceneEmotion) => void
  removeSceneEmotion: (chapterId: string, id: string) => void

  // --- Phase 10: Continuity Engine ---
  continuityEvents: Record<string, ContinuityEvent[]> // Key is chapter_id
  setContinuityEvents: (chapterId: string, events: ContinuityEvent[]) => void
  addContinuityEvent: (event: ContinuityEvent) => void
  removeContinuityEvent: (chapterId: string, id: string) => void

  continuityWarnings: Record<string, ContinuityWarning[]> // Key is chapter_id
  setContinuityWarnings: (chapterId: string, warnings: ContinuityWarning[]) => void
  addContinuityWarning: (warning: ContinuityWarning) => void
  resolveContinuityWarning: (chapterId: string, id: string) => void
  removeContinuityWarning: (chapterId: string, id: string) => void

  // Phase 11: Style Intelligence
  styleProfiles: Record<string, StyleProfile> // Key is book_id
  chapterMetrics: Record<string, ChapterMetric> // Key is chapter_id
  setStyleProfiles: (bookId: string, profile: StyleProfile | null) => void
  updateStyleProfile: (profile: StyleProfile) => void
  setChapterMetrics: (chapterId: string, metric: ChapterMetric | null) => void
  updateChapterMetric: (metric: ChapterMetric) => void

  // --- Phase 12: Relationship Intelligence ---
  relationships: Record<string, Relationship[]> // Key is character_id
  setRelationships: (characterId: string, relationships: Relationship[]) => void
  addRelationship: (characterId: string, relationship: Relationship) => void
  removeRelationship: (characterId: string, id: string) => void

  relationshipEvents: Record<string, RelationshipEvent[]> // Key is relationship_id
  setRelationshipEvents: (relationshipId: string, events: RelationshipEvent[]) => void
  addRelationshipEvent: (relationshipId: string, event: RelationshipEvent) => void
  removeRelationshipEvent: (relationshipId: string, id: string) => void

  relationshipStates: Record<string, RelationshipState[]> // Key is relationship_id
  setRelationshipStates: (relationshipId: string, states: RelationshipState[]) => void
  updateRelationshipState: (state: RelationshipState) => void

  // --- Phase 13: Timeline Intelligence ---
  timelineSettings: TimelineSettings | null
  setTimelineSettings: (settings: TimelineSettings | null) => void

  timelineEvents: TimelineEvent[]
  setTimelineEvents: (events: TimelineEvent[]) => void
  addTimelineEvent: (event: TimelineEvent) => void
  updateTimelineEvent: (event: TimelineEvent) => void
  removeTimelineEvent: (id: string) => void
}

export const useStoryBibleStore = create<StoryBibleStore>((set) => ({
  storyBible: null,
  setStoryBible: (storyBible) => set({ storyBible }),
  updateStoryBible: (storyBible) => set({ storyBible }),

  characterProfiles: {},
  setCharacterProfiles: (profiles) => set((s) => {
    const map: Record<string, CharacterProfile> = {}
    profiles.forEach(p => map[p.character_id] = p)
    return { characterProfiles: map }
  }),
  updateCharacterProfile: (profile) => set((s) => ({
    characterProfiles: { ...s.characterProfiles, [profile.character_id]: profile }
  })),

  locationProfiles: {},
  setLocationProfiles: (profiles) => set((s) => {
    const map: Record<string, LocationProfile> = {}
    profiles.forEach(p => map[p.location_id] = p)
    return { locationProfiles: map }
  }),
  updateLocationProfile: (profile) => set((s) => ({
    locationProfiles: { ...s.locationProfiles, [profile.location_id]: profile }
  })),

  organizationProfiles: {},
  setOrganizationProfiles: (profiles) => set((s) => {
    const map: Record<string, OrganizationProfile> = {}
    profiles.forEach(p => map[p.organization_id] = p)
    return { organizationProfiles: map }
  }),
  updateOrganizationProfile: (profile) => set((s) => ({
    organizationProfiles: { ...s.organizationProfiles, [profile.organization_id]: profile }
  })),

  loreEntries: {},
  setLoreEntries: (entries) => set((s) => {
    const map: Record<string, LoreEntry> = {}
    entries.forEach(p => map[p.codex_id] = p)
    return { loreEntries: map }
  }),
  updateLoreEntry: (entry) => set((s) => ({
    loreEntries: { ...s.loreEntries, [entry.codex_id]: entry }
  })),

  voiceProfiles: {},
  setVoiceProfiles: (profiles) => set((s) => {
    const map: Record<string, CharacterVoiceProfile> = {}
    profiles.forEach(p => map[p.character_id] = p)
    return { voiceProfiles: map }
  }),
  updateVoiceProfile: (profile) => set((s) => ({
    voiceProfiles: { ...s.voiceProfiles, [profile.character_id]: profile }
  })),

  speechPatterns: {},
  setSpeechPatterns: (characterId, patterns) => set((s) => ({
    speechPatterns: { ...s.speechPatterns, [characterId]: patterns }
  })),
  addSpeechPattern: (pattern) => set((s) => ({
    speechPatterns: {
      ...s.speechPatterns,
      [pattern.character_id]: [pattern, ...(s.speechPatterns[pattern.character_id] || [])]
    }
  })),
  removeSpeechPattern: (characterId, id) => set((s) => ({
    speechPatterns: {
      ...s.speechPatterns,
      [characterId]: (s.speechPatterns[characterId] || []).filter(p => p.id !== id)
    }
  })),

  dialogueSamples: {},
  setDialogueSamples: (characterId, samples) => set((s) => ({
    dialogueSamples: { ...s.dialogueSamples, [characterId]: samples }
  })),
  addDialogueSample: (sample) => set((s) => ({
    dialogueSamples: {
      ...s.dialogueSamples,
      [sample.character_id]: [sample, ...(s.dialogueSamples[sample.character_id] || [])]
    }
  })),
  removeDialogueSample: (characterId, id) => set((s) => ({
    dialogueSamples: {
      ...s.dialogueSamples,
      [characterId]: (s.dialogueSamples[characterId] || []).filter(s => s.id !== id)
    }
  })),

  // Phase 9
  chapterEmotions: {},
  setChapterEmotions: (emotions) => set((s) => {
    const map: Record<string, ChapterEmotion> = {}
    emotions.forEach(e => map[e.chapter_id] = e)
    return { chapterEmotions: map }
  }),
  updateChapterEmotion: (emotion) => set((s) => ({
    chapterEmotions: { ...s.chapterEmotions, [emotion.chapter_id]: emotion }
  })),

  sceneEmotions: {},
  setSceneEmotions: (chapterId, emotions) => set((s) => ({
    sceneEmotions: { ...s.sceneEmotions, [chapterId]: emotions }
  })),
  addSceneEmotion: (emotion) => set((s) => ({
    sceneEmotions: {
      ...s.sceneEmotions,
      [emotion.chapter_id]: [...(s.sceneEmotions[emotion.chapter_id] || []), emotion]
    }
  })),
  removeSceneEmotion: (chapterId, id) => set((s) => ({
    sceneEmotions: {
      ...s.sceneEmotions,
      [chapterId]: (s.sceneEmotions[chapterId] || []).filter(e => e.id !== id)
    }
  })),

  // Phase 10
  continuityEvents: {},
  setContinuityEvents: (chapterId, events) => set((s) => ({
    continuityEvents: { ...s.continuityEvents, [chapterId]: events }
  })),
  addContinuityEvent: (event) => set((s) => ({
    continuityEvents: {
      ...s.continuityEvents,
      [event.chapter_id]: [...(s.continuityEvents[event.chapter_id] || []), event]
    }
  })),
  removeContinuityEvent: (chapterId, id) => set((s) => ({
    continuityEvents: {
      ...s.continuityEvents,
      [chapterId]: (s.continuityEvents[chapterId] || []).filter(e => e.id !== id)
    }
  })),

  continuityWarnings: {},
  setContinuityWarnings: (chapterId, warnings) => set((s) => ({
    continuityWarnings: { ...s.continuityWarnings, [chapterId]: warnings }
  })),
  addContinuityWarning: (warning) => set((s) => ({
    continuityWarnings: {
      ...s.continuityWarnings,
      [warning.chapter_id]: [...(s.continuityWarnings[warning.chapter_id] || []), warning]
    }
  })),
  resolveContinuityWarning: (chapterId, id) => set((s) => ({
    continuityWarnings: {
      ...s.continuityWarnings,
      [chapterId]: (s.continuityWarnings[chapterId] || []).map(w => w.id === id ? { ...w, resolved: true } : w)
    }
  })),
  removeContinuityWarning: (chapterId, id) => set((s) => ({
    continuityWarnings: {
      ...s.continuityWarnings,
      [chapterId]: (s.continuityWarnings[chapterId] || []).filter(w => w.id !== id)
    }
  })),

  // Phase 11: Style Intelligence
  styleProfiles: {},
  chapterMetrics: {},
  setStyleProfiles: (bookId, profile) => set((s) => {
    const next = { ...s.styleProfiles }
    if (profile) next[bookId] = profile
    else delete next[bookId]
    return { styleProfiles: next }
  }),
  updateStyleProfile: (profile) => set((s) => ({
    styleProfiles: { ...s.styleProfiles, [profile.book_id]: profile }
  })),
  setChapterMetrics: (chapterId, metric) => set((s) => {
    const next = { ...s.chapterMetrics }
    if (metric) next[chapterId] = metric
    else delete next[chapterId]
    return { chapterMetrics: next }
  }),
  updateChapterMetric: (metric) => set((s) => ({
    chapterMetrics: { ...s.chapterMetrics, [metric.chapter_id]: metric }
  })),

  // Phase 12: Relationship Intelligence
  relationships: {},
  setRelationships: (characterId, relationships) => set((s) => ({
    relationships: { ...s.relationships, [characterId]: relationships }
  })),
  addRelationship: (characterId, relationship) => set((s) => {
    // Replace if exists, otherwise append
    const current = s.relationships[characterId] || []
    const index = current.findIndex(r => r.id === relationship.id)
    if (index !== -1) {
      const copy = [...current]
      copy[index] = relationship
      return { relationships: { ...s.relationships, [characterId]: copy } }
    } else {
      return { relationships: { ...s.relationships, [characterId]: [...current, relationship] } }
    }
  }),
  removeRelationship: (characterId, id) => set((s) => ({
    relationships: {
      ...s.relationships,
      [characterId]: (s.relationships[characterId] || []).filter(r => r.id !== id)
    }
  })),

  relationshipEvents: {},
  setRelationshipEvents: (relationshipId, events) => set((s) => ({
    relationshipEvents: { ...s.relationshipEvents, [relationshipId]: events }
  })),
  addRelationshipEvent: (relationshipId, event) => set((s) => ({
    relationshipEvents: {
      ...s.relationshipEvents,
      [relationshipId]: [...(s.relationshipEvents[relationshipId] || []), event]
    }
  })),
  removeRelationshipEvent: (relationshipId, id) => set((s) => ({
    relationshipEvents: {
      ...s.relationshipEvents,
      [relationshipId]: (s.relationshipEvents[relationshipId] || []).filter(e => e.id !== id)
    }
  })),

  relationshipStates: {},
  setRelationshipStates: (relationshipId, states) => set((state) => ({
    relationshipStates: { ...state.relationshipStates, [relationshipId]: states }
  })),
  updateRelationshipState: (relState) => set((state) => {
    const existing = state.relationshipStates[relState.relationship_id] || []
    const idx = existing.findIndex(s => s.id === relState.id)
    if (idx !== -1) {
      const updated = [...existing]
      updated[idx] = relState
      return { relationshipStates: { ...state.relationshipStates, [relState.relationship_id]: updated } }
    }
    return { relationshipStates: { ...state.relationshipStates, [relState.relationship_id]: [...existing, relState] } }
  }),

  // Phase 13: Timeline Intelligence
  timelineSettings: null,
  setTimelineSettings: (settings) => set({ timelineSettings: settings }),

  timelineEvents: [],
  setTimelineEvents: (events) => set({ timelineEvents: events }),
  addTimelineEvent: (event) => set((state) => ({ timelineEvents: [...state.timelineEvents, event] })),
  updateTimelineEvent: (event) => set((state) => ({
    timelineEvents: state.timelineEvents.map(e => e.id === event.id ? event : e)
  })),
  removeTimelineEvent: (id) => set((state) => ({
    timelineEvents: state.timelineEvents.filter(e => e.id !== id)
  }))
}))
