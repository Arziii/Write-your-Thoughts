// ── Core Entity Types ──────────────────────────────────────────────

export interface User {
  id: string
  email: string
  username?: string
  display_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Settings {
  id: string
  user_id: string
  theme: 'light' | 'dark'
  accent_color: string
  editor_font: string
  font_size: number
  line_spacing: number
  ai_provider: 'openai' | 'gemini' | 'claude'
  ai_api_key?: string
  ai_style_prompt?: string
  preserve_formatting?: boolean
  autosave_interval: number
  created_at: string
}

export type BookStatus = 'planning' | 'writing' | 'completed' | 'archived'

export interface Book {
  id: string
  user_id: string
  title: string
  genre: string
  description: string
  cover_image?: string
  status: BookStatus
  synced: number
  created_at: string
  updated_at: string
}

export interface Chapter {
  id: string
  book_id: string
  title: string
  content: string
  word_count: number
  chapter_order: number
  synced: number
  created_at: string
  updated_at: string
}

export type VersionSource = 'manual' | 'ai_polish' | 'restore'

export interface ChapterVersion {
  id: string
  chapter_id: string
  version_number: number
  content: string
  source: VersionSource
  created_at: string
}

export interface WorkspaceState {
  id: string
  user_id: string
  current_book_id?: string | null
  current_chapter_id?: string | null
  cursor_position: number
  scroll_position: number
  open_tabs: string // JSON array of chapter IDs
  panel_state: string // JSON { sidebarOpen, aiPanelOpen }
  updated_at: string
}

// ── Worldbuilding ──────────────────────────────────────────────────

export interface Character {
  id: string
  book_id: string
  name: string
  nickname: string
  age: string
  gender: string
  appearance: string
  personality: string
  goals: string
  relationships: string
  notes: string
  image_url?: string
  synced: number
  created_at: string
  updated_at: string
}

export interface CharacterVoiceProfile {
  id: string
  character_id: string
  vocabulary: string
  sentence_length: string
  formality: string
  personality: string
  mood: string
  emotional_state: string
  created_at: string
  updated_at: string
}

export interface SpeechPattern {
  id: string
  character_id: string
  pattern_description: string
  created_at: string
  updated_at: string
}

export interface DialogueSample {
  id: string
  character_id: string
  sample_text: string
  context?: string
  created_at: string
  updated_at: string
}

// --- PHASE 12: Relationship Intelligence ---
export interface Relationship {
  id: string
  book_id: string
  source_character_id: string
  target_character_id: string
  relationship_type: string
  trust_level: number
  affection_level: number
  history: string
  current_state: string
  created_at: string
  updated_at: string
}

export interface TimelineSettings {
  book_id: string
  start_date_string: string
  calendar_system: string
}

export interface TimelineEvent {
  id: string
  book_id: string
  title: string
  description: string
  story_day: number
  duration_days: number
  chapter_id?: string
  characters_involved: string
  created_at: string
  updated_at: string
}

export interface RelationshipEvent {
  id: string
  relationship_id: string
  chapter_id?: string
  event_description: string
  impact_on_trust: number
  impact_on_affection: number
  created_at: string
  updated_at: string
}

export interface RelationshipState {
  id: string
  relationship_id: string
  chapter_id: string
  trust_level_at_chapter: number
  affection_level_at_chapter: number
  state_notes: string
  created_at: string
  updated_at: string
}

// ── Phase 13: Timeline Intelligence Types ────────────────────────────

export interface TimelineSettings {
  book_id: string
  start_date_string: string
  calendar_system: string
}

export interface TimelineEvent {
  id: string
  book_id: string
  title: string
  description: string
  story_day: number
  chapter_id: string | null
  characters_involved: string | string[] // Will be parsed from JSON
  created_at: string
  updated_at: string
}

// --- PHASE 9: Emotional Intelligence ---
export interface ChapterEmotion {
  id: string
  chapter_id: string
  primary_emotion: string
  secondary_emotion: string
  intensity: number
  created_at: string
  updated_at: string
}

export interface SceneEmotion {
  id: string
  chapter_id: string
  scene_description: string
  primary_emotion: string
  intensity: number
  created_at: string
  updated_at: string
}

// --- PHASE 10: Continuity Engine ---
export interface ContinuityEvent {
  id: string
  chapter_id: string
  description: string
  event_type: string
  entity_id: string | null
  created_at: string
  updated_at: string
}

export interface ContinuityWarning {
  id: string
  chapter_id: string
  warning_description: string
  severity: string
  resolved: boolean
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  book_id: string
  name: string
  description: string
  culture: string
  history: string
  notes: string
  image_url?: string
  synced: number
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  book_id: string
  title: string
  content: string
  synced: number
  created_at: string
  updated_at: string
}

export interface Codex {
  id: string
  book_id: string
  title: string
  content: string
  synced: number
  created_at: string
  updated_at: string
}

export interface Wiki {
  id: string
  book_id: string
  title: string
  content: string
  synced: number
  created_at: string
  updated_at: string
}

export interface Organization {
  id: string
  book_id: string
  title: string
  content: string
  synced: number
  created_at: string
  updated_at: string
}

export interface WorldRule {
  id: string
  book_id: string
  title: string
  content: string
  synced: number
  created_at: string
  updated_at: string
}

// ── StoryMind AI Profiles ───────────────────────────────────────────

export interface StoryBible {
  id: string
  book_id: string
  global_context: string
  themes: string
  indexed_at: string | null
  created_at: string
  updated_at: string
}

export interface CharacterProfile {
  id: string
  character_id: string
  traits: string
  personality: string
  motivations: string
  speech_style: string
  indexed_at: string | null
  created_at: string
  updated_at: string
}

export interface LocationProfile {
  id: string
  location_id: string
  geography: string
  history: string
  culture: string
  indexed_at: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationProfile {
  id: string
  organization_id: string
  hierarchy: string
  goals: string
  relationships: string
  indexed_at: string | null
  created_at: string
  updated_at: string
}

export interface LoreEntry {
  id: string
  codex_id: string
  summary: string
  facts: string
  indexed_at: string | null
  created_at: string
  updated_at: string
}

export interface TimelineEvent {
  id: string
  book_id: string
  title: string
  description: string
  event_date: string
  sort_order: number
  notes: string
  synced: number
  created_at: string
  updated_at: string
}

// ── Phase 14: Story Intelligence ──────────────────────────────────────

export interface StoryAnalysis {
  id: string
  book_id: string
  fatigue_warning: string
  repetition_warning: string
  created_at: string
  updated_at: string
}

export interface ArcAnalysis {
  id: string
  character_id: string
  book_id: string
  arc_status: string
  emotional_change: string
  created_at: string
  updated_at: string
}

export interface PacingAnalysis {
  id: string
  book_id: string
  pacing_status: string
  conflict_density: string
  created_at: string
  updated_at: string
}

export interface EmotionAnalysis {
  id: string
  book_id: string
  emotional_flow_status: string
  warning: string
  created_at: string
  updated_at: string
}

export interface ChapterStatistics {
  id: string
  chapter_id: string
  repetition_warnings: string
  scene_density: string
  created_at: string
  updated_at: string
}

// ── Tab type ───────────────────────────────────────────────────────

export type TabType = 'chapter' | 'character' | 'location' | 'note' | 'timeline' | 'codex' | 'wiki' | 'organization' | 'world_rule' | 'story_intelligence' | 'relationship_manager'

export interface EditorTab {
  id: string          // Unique ID for the tab (usually the entity ID)
  type: TabType
  entityId: string    // The ID of the actual entity
  title: string
  isDirty: boolean
}

// ── AI ─────────────────────────────────────────────────────────────

export type AIProvider = 'openai' | 'gemini' | 'claude'
export type AIMode = 'grammar' | 'balanced' | 'strong' | 'expand' | 'shorten' | 'describe' | 'custom'

export interface AIPolishResult {
  polishedContent: string
  explanation: string
  provider: AIProvider
}

export interface AIBrainstormMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIBrainstormOptions {
  messages: AIBrainstormMessage[]
  provider: AIProvider
  apiKey: string
  storyContext?: string
}

// ── Panel State ────────────────────────────────────────────────────

export interface PanelState {
  sidebarOpen: boolean
  aiPanelOpen: boolean
  lockedEntities: string[]
}

// ── Toast ──────────────────────────────────────────────────────────

export type ToastType = 'success' | 'info' | 'warning' | 'error'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

// ── Phase 11: Style Intelligence ───────────────────────────────────

export interface StyleProfile {
  id: string
  book_id: string
  sentence_length: string
  dialogue_ratio: string
  vocabulary: string
  tone: string
  prose_density: string
  created_at: string
  updated_at: string
}

export interface ChapterMetric {
  id: string
  chapter_id: string
  sentence_length: string
  dialogue_ratio: string
  vocabulary: string
  tone: string
  prose_density: string
  warning: string
  created_at: string
  updated_at: string
}

