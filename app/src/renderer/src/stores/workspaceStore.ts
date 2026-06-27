import { create } from 'zustand'
import type { 
  Book, Chapter, EditorTab, PanelState, TabType,
  Character, Location, Note, TimelineEvent, TimelineSettings, Codex, Wiki,
  Organization, WorldRule
} from '../types'

interface WorkspaceStore {
  // Books
  books: Book[]
  currentBook: Book | null
  setBooks: (books: Book[]) => void
  setCurrentBook: (book: Book | null) => void
  addBook: (book: Book) => void
  updateBook: (book: Book) => void
  removeBook: (bookId: string) => void

  // Chapters
  chapters: Chapter[]
  setChapters: (chapters: Chapter[]) => void
  addChapter: (chapter: Chapter) => void
  updateChapter: (chapter: Chapter) => void
  removeChapter: (chapterId: string) => void
  reorderChapters: (startIndex: number, endIndex: number) => Promise<void>

  // Characters
  characters: Character[]
  setCharacters: (characters: Character[]) => void
  addCharacter: (character: Character) => void
  updateCharacter: (character: Character) => void
  removeCharacter: (characterId: string) => void

  // Locations
  locations: Location[]
  setLocations: (locations: Location[]) => void
  addLocation: (location: Location) => void
  updateLocation: (location: Location) => void
  removeLocation: (locationId: string) => void

  // Notes
  notes: Note[]
  setNotes: (notes: Note[]) => void
  addNote: (note: Note) => void
  updateNote: (note: Note) => void
  removeNote: (noteId: string) => void

  // Codex
  codex: Codex[]
  setCodex: (codex: Codex[]) => void
  addCodex: (codex: Codex) => void
  updateCodex: (codex: Codex) => void
  removeCodex: (codexId: string) => void

  // Wiki
  wiki: Wiki[]
  setWiki: (wiki: Wiki[]) => void
  addWiki: (wiki: Wiki) => void
  updateWiki: (wiki: Wiki) => void
  removeWiki: (wikiId: string) => void

  // Organizations
  organizations: Organization[]
  setOrganizations: (organizations: Organization[]) => void
  addOrganization: (organization: Organization) => void
  updateOrganization: (organization: Organization) => void
  removeOrganization: (organizationId: string) => void

  // World Rules
  worldRules: WorldRule[]
  setWorldRules: (worldRules: WorldRule[]) => void
  addWorldRule: (worldRule: WorldRule) => void
  updateWorldRule: (worldRule: WorldRule) => void
  removeWorldRule: (worldRuleId: string) => void

  // Timeline
  timelineSettings: TimelineSettings | null
  setTimelineSettings: (settings: TimelineSettings | null) => void
  timelineEvents: TimelineEvent[]
  setTimelineEvents: (events: TimelineEvent[]) => void
  addTimelineEvent: (event: TimelineEvent) => void
  updateTimelineEvent: (event: TimelineEvent) => void
  removeTimelineEvent: (eventId: string) => void

  // Editor Tabs
  activeTabId: string | null
  setActiveTabId: (tabId: string | null) => void
  tabs: EditorTab[]
  setTabs: (tabs: EditorTab[]) => void
  openTab: (entityId: string, type: TabType, title: string) => void
  closeTab: (tabId: string) => void
  markTabDirty: (tabId: string, dirty: boolean) => void

  // Helpers for backwards compatibility / ease of use
  activeChapter: Chapter | null // Computed or synced state

  // Panels
  panelState: PanelState
  setPanelState: (state: PanelState) => void
  toggleSidebar: () => void
  toggleAIPanel: () => void
  toggleEntityLock: (entityId: string) => void

  // Focus mode
  focusMode: boolean
  setFocusMode: (mode: boolean) => void

  // In-memory drafts: unsaved form data keyed by entityId.
  // Survives tab switching because it lives in the store, not component state.
  drafts: Record<string, Record<string, any>>
  setDraft: (entityId: string, data: Record<string, any>) => void
  clearDraft: (entityId: string) => void

  // Drag and Drop
  reorderEntity: (
    stateKey: 'characters' | 'locations' | 'notes' | 'codex' | 'wiki' | 'organizations' | 'worldRules',
    table: string,
    startIndex: number,
    endIndex: number
  ) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  // Books
  books: [],
  currentBook: null,
  setBooks: (books) => set({ books }),
  setCurrentBook: (currentBook) => set({ currentBook }),
  addBook: (book) => set((s) => ({ books: [book, ...s.books] })),
  updateBook: (book) => set((s) => ({
    books: s.books.map((b) => b.id === book.id ? book : b),
    currentBook: s.currentBook?.id === book.id ? book : s.currentBook,
  })),
  removeBook: (bookId) => set((s) => ({
    books: s.books.filter((b) => b.id !== bookId),
    currentBook: s.currentBook?.id === bookId ? null : s.currentBook,
  })),

  // Chapters
  chapters: [],
  setChapters: (chapters) => set({ chapters }),
  addChapter: (chapter) => set((s) => ({ chapters: [...s.chapters, chapter] })),
  updateChapter: (chapter) => set((s) => {
    const updated = s.chapters.map((c) => c.id === chapter.id ? chapter : c)
    return {
      chapters: updated,
      activeChapter: s.activeChapter?.id === chapter.id ? chapter : s.activeChapter,
      tabs: s.tabs.map(t => t.id === chapter.id ? { ...t, title: chapter.title } : t)
    }
  }),
  removeChapter: (chapterId) => set((s) => {
    const activeTabWasThis = s.activeTabId === chapterId
    const newTabs = s.tabs.filter((t) => t.id !== chapterId)
    return {
      chapters: s.chapters.filter((c) => c.id !== chapterId),
      tabs: newTabs,
      activeTabId: activeTabWasThis ? (newTabs.length > 0 ? newTabs[newTabs.length-1].id : null) : s.activeTabId,
      activeChapter: s.activeChapter?.id === chapterId ? null : s.activeChapter
    }
  }),
  reorderChapters: async (startIndex, endIndex) => {
    const { chapters } = get()
    const result = Array.from(chapters)
    const [removed] = result.splice(startIndex, 1)
    result.splice(endIndex, 0, removed)
    
    // Update local state optimisticly
    set({ chapters: result })

    // Call IPC to save order
    const updates = result.map((ch, idx) => ({ id: ch.id, order: idx }))
    await window.api.chapters.reorder(updates)
  },

  // Characters
  characters: [],
  setCharacters: (characters) => set({ characters }),
  addCharacter: (character) => set((s) => ({ characters: [...s.characters, character] })),
  updateCharacter: (character) => set((s) => ({
    characters: s.characters.map((c) => c.id === character.id ? character : c),
    tabs: s.tabs.map(t => t.id === character.id ? { ...t, title: character.name } : t)
  })),
  removeCharacter: (characterId) => set((s) => {
    const newTabs = s.tabs.filter((t) => t.id !== characterId)
    return {
      characters: s.characters.filter((c) => c.id !== characterId),
      tabs: newTabs,
      activeTabId: s.activeTabId === characterId ? (newTabs[newTabs.length-1]?.id || null) : s.activeTabId
    }
  }),

  // Locations
  locations: [],
  setLocations: (locations) => set({ locations }),
  addLocation: (location) => set((s) => ({ locations: [...s.locations, location] })),
  updateLocation: (location) => set((s) => ({
    locations: s.locations.map((l) => l.id === location.id ? location : l),
    tabs: s.tabs.map(t => t.id === location.id ? { ...t, title: location.name } : t)
  })),
  removeLocation: (locationId) => set((s) => {
    const newTabs = s.tabs.filter((t) => t.id !== locationId)
    return {
      locations: s.locations.filter((l) => l.id !== locationId),
      tabs: newTabs,
      activeTabId: s.activeTabId === locationId ? (newTabs[newTabs.length-1]?.id || null) : s.activeTabId
    }
  }),

  // Notes
  notes: [],
  setNotes: (notes) => set({ notes }),
  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNote: (note) => set((s) => {
    const updated = s.notes.map((n) => n.id === note.id ? note : n)
    const tabUpdated = s.tabs.map(t => t.entityId === note.id ? { ...t, title: note.title } : t)
    return { notes: updated, tabs: tabUpdated }
  }),
  removeNote: (noteId) => set((s) => ({
    notes: s.notes.filter((n) => n.id !== noteId),
    tabs: s.tabs.filter((t) => t.entityId !== noteId)
  })),

  // Codex
  codex: [],
  setCodex: (codex) => set({ codex }),
  addCodex: (item) => set((s) => ({ codex: [item, ...s.codex] })),
  updateCodex: (item) => set((s) => {
    const updated = s.codex.map((c) => c.id === item.id ? item : c)
    const tabUpdated = s.tabs.map(t => t.entityId === item.id ? { ...t, title: item.title } : t)
    return { codex: updated, tabs: tabUpdated }
  }),
  removeCodex: (id) => set((s) => ({
    codex: s.codex.filter((c) => c.id !== id),
    tabs: s.tabs.filter((t) => t.entityId !== id)
  })),

  // Wiki
  wiki: [],
  setWiki: (wiki) => set({ wiki }),
  addWiki: (item) => set((s) => ({ wiki: [item, ...s.wiki] })),
  updateWiki: (item) => set((s) => {
    const updated = s.wiki.map((w) => w.id === item.id ? item : w)
    const tabUpdated = s.tabs.map(t => t.entityId === item.id ? { ...t, title: item.title } : t)
    return { wiki: updated, tabs: tabUpdated }
  }),
  removeWiki: (id) => set((s) => ({
    wiki: s.wiki.filter((w) => w.id !== id),
    tabs: s.tabs.filter((t) => t.entityId !== id)
  })),

  // Organizations
  organizations: [],
  setOrganizations: (organizations) => set({ organizations }),
  addOrganization: (item) => set((s) => ({ organizations: [item, ...s.organizations] })),
  updateOrganization: (item) => set((s) => {
    const updated = s.organizations.map((o) => o.id === item.id ? item : o)
    const tabUpdated = s.tabs.map(t => t.entityId === item.id ? { ...t, title: item.title } : t)
    return { organizations: updated, tabs: tabUpdated }
  }),
  removeOrganization: (id) => set((s) => ({
    organizations: s.organizations.filter((o) => o.id !== id),
    tabs: s.tabs.filter((t) => t.entityId !== id)
  })),

  // World Rules
  worldRules: [],
  setWorldRules: (worldRules) => set({ worldRules }),
  addWorldRule: (item) => set((s) => ({ worldRules: [item, ...s.worldRules] })),
  updateWorldRule: (item) => set((s) => {
    const updated = s.worldRules.map((w) => w.id === item.id ? item : w)
    const tabUpdated = s.tabs.map(t => t.entityId === item.id ? { ...t, title: item.title } : t)
    return { worldRules: updated, tabs: tabUpdated }
  }),
  removeWorldRule: (id) => set((s) => ({
    worldRules: s.worldRules.filter((w) => w.id !== id),
    tabs: s.tabs.filter((t) => t.entityId !== id)
  })),

  // Timeline
  timelineSettings: null,
  setTimelineSettings: (settings) => set({ timelineSettings: settings }),
  timelineEvents: [],
  setTimelineEvents: (events) => set({ timelineEvents: events }),
  addTimelineEvent: (event) => set((state) => ({ timelineEvents: [...state.timelineEvents, event] })),
  updateTimelineEvent: (event) =>
    set((state) => ({
      timelineEvents: state.timelineEvents.map((t) => (t.id === event.id ? event : t)),
    })),
  removeTimelineEvent: (id) =>
    set((state) => ({
      timelineEvents: state.timelineEvents.filter((t) => t.id !== id),
    })),

  // Editor Tabs
  activeTabId: null,
  activeChapter: null,
  setActiveTabId: (tabId) => set((s) => {
    // Also sync activeChapter for backwards compat
    const isChapter = s.tabs.find(t => t.id === tabId)?.type === 'chapter'
    const chapter = isChapter ? s.chapters.find(c => c.id === tabId) || null : null
    return { activeTabId: tabId, activeChapter: chapter }
  }),
  tabs: [],
  setTabs: (tabs) => set({ tabs }),
  openTab: (entityId, type, title) => {
    const { tabs, chapters } = get()
    if (tabs.find((t) => t.id === entityId)) {
      set({ 
        activeTabId: entityId,
        activeChapter: type === 'chapter' ? chapters.find(c => c.id === entityId) || null : null
      })
      return
    }
    set({
      tabs: [...tabs, { id: entityId, entityId, type, title, isDirty: false }],
      activeTabId: entityId,
      activeChapter: type === 'chapter' ? chapters.find(c => c.id === entityId) || null : null
    })
  },
  closeTab: (tabId) => {
    const { tabs, activeTabId, chapters } = get()
    const newTabs = tabs.filter((t) => t.id !== tabId)
    const newActiveId = activeTabId === tabId
      ? newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null
      : activeTabId
      
    const newActiveType = newTabs.find(t => t.id === newActiveId)?.type
    const newActiveChapter = newActiveType === 'chapter' ? chapters.find(c => c.id === newActiveId) || null : null

    set({ tabs: newTabs, activeTabId: newActiveId, activeChapter: newActiveChapter })
  },
  markTabDirty: (tabId, dirty) => set((s) => ({
    tabs: s.tabs.map((t) => t.id === tabId ? { ...t, isDirty: dirty } : t),
  })),

  // Panels
  panelState: { sidebarOpen: true, aiPanelOpen: true, lockedEntities: [] },
  setPanelState: (panelState) => set({ panelState }),
  toggleSidebar: () => set((s) => ({
    panelState: { ...s.panelState, sidebarOpen: !s.panelState.sidebarOpen }
  })),
  toggleAIPanel: () => set((s) => ({
    panelState: { ...s.panelState, aiPanelOpen: !s.panelState.aiPanelOpen }
  })),
  toggleEntityLock: (entityId) => set((s) => {
    const locked = s.panelState.lockedEntities || []
    const isLocked = locked.includes(entityId)
    return {
      panelState: {
        ...s.panelState,
        lockedEntities: isLocked 
          ? locked.filter(id => id !== entityId)
          : [...locked, entityId]
      }
    }
  }),

  // Focus mode
  focusMode: false,
  setFocusMode: (focusMode) => set({ focusMode }),

  // In-memory drafts
  drafts: {},
  setDraft: (entityId, data) =>
    set((s) => ({ drafts: { ...s.drafts, [entityId]: data } })),
  clearDraft: (entityId) =>
    set((s) => {
      const { [entityId]: _, ...rest } = s.drafts
      return { drafts: rest }
    }),

  reorderEntity: async (stateKey, table, startIndex, endIndex) => {
    const state = get()
    const items = Array.from(state[stateKey] as any[])
    const [removed] = items.splice(startIndex, 1)
    items.splice(endIndex, 0, removed)

    // Optimistic update
    set({ [stateKey]: items } as any)

    // Sync to backend
    const updates = items.map((item: any, idx: number) => ({ id: item.id, sort_order: idx }))
    await window.api.entities.reorder({ table, items: updates })
  },
}))
