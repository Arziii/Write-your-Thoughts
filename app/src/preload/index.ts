import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    onMaximized: (cb: () => void) => ipcRenderer.on('window:maximized', cb),
    onUnmaximized: (cb: () => void) => ipcRenderer.on('window:unmaximized', cb),
  },

  // Auth
  auth: {
    storeUser: (user: unknown) => ipcRenderer.invoke('auth:storeUser', user),
    getStoredUser: (userId: string) => ipcRenderer.invoke('auth:getStoredUser', userId),
  },

  // Database Backup/Restore
  database: {
    getBuffer: () => ipcRenderer.invoke('database:getBuffer'),
    restoreBuffer: (buffer: Uint8Array) => ipcRenderer.invoke('database:restoreBuffer', buffer),
  },

  // Books
  books: {
    getAll: (userId: string) => ipcRenderer.invoke('books:getAll', userId),
    getById: (id: string) => ipcRenderer.invoke('books:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('books:create', data),
    update: (data: unknown) => ipcRenderer.invoke('books:update', data),
    delete: (id: string) => ipcRenderer.invoke('books:delete', id),
  },

  // Chapters
  chapters: {
    getByBook: (bookId: string) => ipcRenderer.invoke('chapters:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('chapters:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('chapters:create', data),
    save: (data: unknown) => ipcRenderer.invoke('chapters:save', data),
    update: (data: unknown) => ipcRenderer.invoke('chapters:update', data),
    rename: (data: unknown) => ipcRenderer.invoke('chapters:rename', data),
    delete: (id: string) => ipcRenderer.invoke('chapters:delete', id),
    reorder: (chapters: unknown) => ipcRenderer.invoke('chapters:reorder', chapters),
    getVersions: (chapterId: string) => ipcRenderer.invoke('chapters:getVersions', chapterId),
    saveVersion: (data: unknown) => ipcRenderer.invoke('chapters:saveVersion', data),
    restoreVersion: (data: unknown) => ipcRenderer.invoke('chapters:restoreVersion', data),
  },

  // Editor / Workspace
  editor: {
    getWorkspaceState: (userId: string) => ipcRenderer.invoke('editor:getWorkspaceState', userId),
    saveWorkspaceState: (data: unknown) => ipcRenderer.invoke('editor:saveWorkspaceState', data),
  },

  // Settings
  settings: {
    get: (userId: string) => ipcRenderer.invoke('settings:get', userId),
    update: (data: unknown) => ipcRenderer.invoke('settings:update', data),
  },

  // Worldbuilding
  characters: {
    getByBook: (bookId: string) => ipcRenderer.invoke('characters:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('characters:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('characters:create', data),
    update: (data: unknown) => ipcRenderer.invoke('characters:update', data),
    delete: (id: string) => ipcRenderer.invoke('characters:delete', id),
  },

  locations: {
    getByBook: (bookId: string) => ipcRenderer.invoke('locations:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('locations:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('locations:create', data),
    update: (data: unknown) => ipcRenderer.invoke('locations:update', data),
    delete: (id: string) => ipcRenderer.invoke('locations:delete', id),
  },

  notes: {
    getByBook: (bookId: string) => ipcRenderer.invoke('notes:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('notes:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('notes:create', data),
    update: (data: unknown) => ipcRenderer.invoke('notes:update', data),
    delete: (id: string) => ipcRenderer.invoke('notes:delete', id),
  },

  timeline: {
    getByBook: (bookId: string) => ipcRenderer.invoke('timeline:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('timeline:getById', id),
    create: (data: unknown) => ipcRenderer.invoke('timeline:create', data),
    update: (data: unknown) => ipcRenderer.invoke('timeline:update', data),
    delete: (id: string) => ipcRenderer.invoke('timeline:delete', id),
    reorder: (events: unknown) => ipcRenderer.invoke('timeline:reorder', events),
  },

  search: {
    global: (data: unknown) => ipcRenderer.invoke('search:global', data),
  },

  export: {
    book: (bookId: string, format: string, authorName?: string) => ipcRenderer.invoke('export:book', { bookId, format, authorName }),
  },

  entities: {
    reorder: (data: { table: string, items: Array<{ id: string, sort_order: number }> }) => ipcRenderer.invoke('entities:reorder', data)
  },

  // Plugins
  plugins: {
    getAll: () => ipcRenderer.invoke('plugins:getAll'),
    save: (data: { name: string, code: string }) => ipcRenderer.invoke('plugins:save', data),
    delete: (id: string) => ipcRenderer.invoke('plugins:delete', id),
  },

  // Comments
  comments: {
    getByChapter: (chapterId: string) => ipcRenderer.invoke('comments:getByChapter', chapterId),
    create: (data: { chapterId: string, content: string, quote: string }) => ipcRenderer.invoke('comments:create', data),
    resolve: (id: string) => ipcRenderer.invoke('comments:resolve', id),
    delete: (id: string) => ipcRenderer.invoke('comments:delete', id),
  },

  // Codex
  codex: {
    getByBook: (bookId: string) => ipcRenderer.invoke('codex:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('codex:getById', id),
    create: (data: { bookId: string; title: string }) => ipcRenderer.invoke('codex:create', data),
    update: (data: any) => ipcRenderer.invoke('codex:update', data),
    delete: (id: string) => ipcRenderer.invoke('codex:delete', id),
  },

  // Wiki
  wiki: {
    getByBook: (bookId: string) => ipcRenderer.invoke('wiki:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('wiki:getById', id),
    create: (data: { bookId: string; title: string }) => ipcRenderer.invoke('wiki:create', data),
    update: (data: any) => ipcRenderer.invoke('wiki:update', data),
    delete: (id: string) => ipcRenderer.invoke('wiki:delete', id),
  },

  // Organizations
  organizations: {
    getByBook: (bookId: string) => ipcRenderer.invoke('organizations:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('organizations:getById', id),
    create: (data: { bookId: string; title: string }) => ipcRenderer.invoke('organizations:create', data),
    update: (data: any) => ipcRenderer.invoke('organizations:update', data),
    delete: (id: string) => ipcRenderer.invoke('organizations:delete', id),
  },

  // World Rules
  worldRules: {
    getByBook: (bookId: string) => ipcRenderer.invoke('worldRules:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('worldRules:getById', id),
    create: (data: { bookId: string; title: string }) => ipcRenderer.invoke('worldRules:create', data),
    update: (data: any) => ipcRenderer.invoke('worldRules:update', data),
    delete: (id: string) => ipcRenderer.invoke('worldRules:delete', id),
  },

  // Story Bible (AI Intelligence Layer)
  storyBible: {
    getByBook: (bookId: string) => ipcRenderer.invoke('storyBible:getByBook', bookId),
    upsert: (data: any) => ipcRenderer.invoke('storyBible:upsert', data),
  },

  characterProfiles: {
    getByCharacter: (characterId: string) => ipcRenderer.invoke('characterProfiles:getByCharacter', characterId),
    upsert: (data: any) => ipcRenderer.invoke('characterProfiles:upsert', data),
  },

  locationProfiles: {
    getByLocation: (locationId: string) => ipcRenderer.invoke('locationProfiles:getByLocation', locationId),
    upsert: (data: any) => ipcRenderer.invoke('locationProfiles:upsert', data),
  },

  organizationProfiles: {
    getByOrganization: (organizationId: string) => ipcRenderer.invoke('organizationProfiles:getByOrganization', organizationId),
    upsert: (data: any) => ipcRenderer.invoke('organizationProfiles:upsert', data),
  },

  loreEntries: {
    getByCodex: (codexId: string) => ipcRenderer.invoke('loreEntries:getByCodex', codexId),
    upsert: (data: any) => ipcRenderer.invoke('loreEntries:upsert', data),
  },

  // Phase 8: Character Voice Intelligence
  characterVoice: {
    getProfile: (characterId: string) => ipcRenderer.invoke('characterVoice:getProfile', characterId),
    upsertProfile: (data: any) => ipcRenderer.invoke('characterVoice:upsertProfile', data),
  },
  speechPatterns: {
    getByCharacter: (characterId: string) => ipcRenderer.invoke('speechPatterns:getByCharacter', characterId),
    create: (data: { character_id: string; pattern_description: string }) => ipcRenderer.invoke('speechPatterns:create', data),
    delete: (id: string) => ipcRenderer.invoke('speechPatterns:delete', id),
  },
  dialogueSamples: {
    getByCharacter: (characterId: string) => ipcRenderer.invoke('dialogueSamples:getByCharacter', characterId),
    create: (data: { character_id: string; sample_text: string; context: string }) => ipcRenderer.invoke('dialogueSamples:create', data),
    delete: (id: string) => ipcRenderer.invoke('dialogueSamples:delete', id),
  },

  // Phase 9: Emotional Intelligence
  chapterEmotions: {
    getByChapter: (chapterId: string) => ipcRenderer.invoke('chapterEmotions:getByChapter', chapterId),
    upsert: (data: any) => ipcRenderer.invoke('chapterEmotions:upsert', data),
  },
  sceneEmotions: {
    getByChapter: (chapterId: string) => ipcRenderer.invoke('sceneEmotions:getByChapter', chapterId),
    create: (data: { chapter_id: string; scene_description: string; primary_emotion: string; intensity: number }) => ipcRenderer.invoke('sceneEmotions:create', data),
    delete: (id: string) => ipcRenderer.invoke('sceneEmotions:delete', id),
  },

  // Phase 10: Continuity Engine
  continuityEvents: {
    getByChapter: (chapterId: string) => ipcRenderer.invoke('continuityEvents:getByChapter', chapterId),
    create: (data: { chapter_id: string; description: string; event_type?: string; entity_id?: string }) => ipcRenderer.invoke('continuityEvents:create', data),
    delete: (id: string) => ipcRenderer.invoke('continuityEvents:delete', id),
  },
  continuityWarnings: {
    getByChapter: (chapterId: string) => ipcRenderer.invoke('continuityWarnings:getByChapter', chapterId),
    create: (data: { chapter_id: string; warning_description: string; severity?: string }) => ipcRenderer.invoke('continuityWarnings:create', data),
    resolve: (id: string) => ipcRenderer.invoke('continuityWarnings:resolve', id),
    delete: (id: string) => ipcRenderer.invoke('continuityWarnings:delete', id),
  },

  // Phase 11: Style Intelligence
  styleProfiles: {
    getByBook: (bookId: string) => ipcRenderer.invoke('styleProfiles:getByBook', bookId),
    upsert: (data: any) => ipcRenderer.invoke('styleProfiles:upsert', data),
  },
  chapterMetrics: {
    getByChapter: (chapterId: string) => ipcRenderer.invoke('chapterMetrics:getByChapter', chapterId),
    upsert: (data: any) => ipcRenderer.invoke('chapterMetrics:upsert', data),
  },

  // Phase 12: Relationship Intelligence
  relationships: {
    getByBook: (bookId: string) => ipcRenderer.invoke('relationships:getByBook', bookId),
    upsert: (data: any) => ipcRenderer.invoke('relationships:upsert', data),
    delete: (id: string) => ipcRenderer.invoke('relationships:delete', id),
  },
  relationshipEvents: {
    getByRelationship: (relationshipId: string) => ipcRenderer.invoke('relationshipEvents:getByRelationship', relationshipId),
    create: (data: any) => ipcRenderer.invoke('relationshipEvents:create', data),
    delete: (id: string) => ipcRenderer.invoke('relationshipEvents:delete', id),
  },
  relationshipStates: {
    getByRelationship: (relationshipId: string) => ipcRenderer.invoke('relationshipStates:getByRelationship', relationshipId),
    upsert: (data: any) => ipcRenderer.invoke('relationshipStates:upsert', data),
  },

  // Phase 13: Timeline Intelligence
  timelineSettings: {
    get: (bookId: string) => ipcRenderer.invoke('timelineSettings:get', bookId),
    upsert: (data: any) => ipcRenderer.invoke('timelineSettings:upsert', data),
  },
  timelineEvents: {
    getByBook: (bookId: string) => ipcRenderer.invoke('timeline:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('timeline:getById', id),
    create: (data: any) => ipcRenderer.invoke('timeline:create', data),
    update: (data: any) => ipcRenderer.invoke('timeline:update', data),
    delete: (id: string) => ipcRenderer.invoke('timeline:delete', id),
  },

  // Phase 14: Story Intelligence
  storyAnalysis: {
    get: (bookId: string) => ipcRenderer.invoke('storyIntelligence:getStoryAnalysis', bookId),
    upsert: (data: any) => ipcRenderer.invoke('storyIntelligence:upsertStoryAnalysis', data),
  },
  arcAnalysis: {
    getByBook: (bookId: string) => ipcRenderer.invoke('storyIntelligence:getArcAnalysis', bookId),
    upsert: (data: any) => ipcRenderer.invoke('storyIntelligence:upsertArcAnalysis', data),
  },
  pacingAnalysis: {
    get: (bookId: string) => ipcRenderer.invoke('storyIntelligence:getPacingAnalysis', bookId),
    upsert: (data: any) => ipcRenderer.invoke('storyIntelligence:upsertPacingAnalysis', data),
  },
  emotionAnalysis: {
    get: (bookId: string) => ipcRenderer.invoke('storyIntelligence:getEmotionAnalysis', bookId),
    upsert: (data: any) => ipcRenderer.invoke('storyIntelligence:upsertEmotionAnalysis', data),
  },
  chapterStatistics: {
    getByBook: (bookId: string) => ipcRenderer.invoke('storyIntelligence:getChapterStatistics', bookId),
    upsert: (data: any) => ipcRenderer.invoke('storyIntelligence:upsertChapterStatistics', data),
  },

  // Timeline Record (Verse Timeline)
  verseTimeline: {
    getByBook: (bookId: string) => ipcRenderer.invoke('verseTimeline:getByBook', bookId),
    getById: (id: string) => ipcRenderer.invoke('verseTimeline:getById', id),
    create: (data: any) => ipcRenderer.invoke('verseTimeline:create', data),
    update: (data: any) => ipcRenderer.invoke('verseTimeline:update', data),
    delete: (id: string) => ipcRenderer.invoke('verseTimeline:delete', id),
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
