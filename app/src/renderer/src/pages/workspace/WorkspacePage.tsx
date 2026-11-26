import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import Dashboard from './Dashboard'
import EditorView from './EditorView'
import type { Book, EditorTab, WorkspaceState } from '../../types'

function loadOptional<T>(request: Promise<T>, fallback: T): Promise<T> {
  return request.catch((error) => {
    console.error('Failed to load book data:', error)
    return fallback
  })
}

export default function WorkspacePage() {
  const { bookId, chapterId } = useParams()
  const { user, isFreshLogin } = useUserStore()
  const { currentBook, activeTabId, tabs, panelState } = useWorkspaceStore()
  const openTabIds = JSON.stringify(tabs.map((tab) => tab.id))
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const userId = user?.id
    if (!userId) return
    let cancelled = false
    const workspace = useWorkspaceStore.getState()
    const story = useStoryBibleStore.getState()

    async function load() {
      if (bookId && workspace.currentBook?.id === bookId) {
        const chapter = workspace.chapters.find((item) => item.id === chapterId)
        if (chapter && workspace.activeTabId !== chapter.id) workspace.openTab(chapter.id, 'chapter', chapter.title)
        if (chapterId === `maps-${bookId}` && workspace.activeTabId !== chapterId) workspace.openTab(chapterId, 'maps', 'Maps')
        return
      }

      setIsLoading(true)
      const session = await window.api.editor.getWorkspaceState(userId).catch(() => null) as WorkspaceState | null
      if (cancelled) return
      if (session && !workspace.currentBook) {
        try { workspace.setPanelState(JSON.parse(session.panel_state)) } catch {}
      }

      if (!bookId) {
        if (session?.current_book_id && !isFreshLogin && !workspace.currentBook && !Object.keys(workspace.bookTabs).length) {
          navigate(`/book/${session.current_book_id}`, { replace: true })
          return
        }
        workspace.setCurrentBook(null)
        if (workspace.currentBook) {
          await window.api.editor.saveWorkspaceState({
            userId, currentBookId: null, currentChapterId: null, openTabs: [], panelState: workspace.panelState
          })
        }
        return
      }

      const book = await window.api.books.getById(bookId) as Book | null
      if (cancelled) return
      if (!book) {
        workspace.setCurrentBook(null)
        return
      }

      const [chapters, characters, locations, notes, timeline, verse, settings, codex, wiki, organizations, rules, bible] =
        await Promise.all([
          window.api.chapters.getByBook(bookId),
          loadOptional(window.api.characters.getByBook(bookId), []),
          loadOptional(window.api.locations.getByBook(bookId), []),
          loadOptional(window.api.notes.getByBook(bookId), []),
          loadOptional(window.api.timelineEvents.getByBook(bookId), []),
          loadOptional(window.api.verseTimeline.getByBook(bookId), []),
          loadOptional(window.api.timelineSettings.get(bookId), null),
          loadOptional(window.api.codex.getByBook(bookId), []),
          loadOptional(window.api.wiki.getByBook(bookId), []),
          loadOptional(window.api.organizations.getByBook(bookId), []),
          loadOptional(window.api.worldRules.getByBook(bookId), []),
          loadOptional(window.api.storyBible.getByBook(bookId), null)
        ])
      if (cancelled) return

      workspace.setCurrentBook(book)
      useWorkspaceStore.setState({
        chapters, characters, locations, notes, timelineEvents: timeline,
        timelineSettings: settings, codex, wiki, organizations, worldRules: rules
      })
      story.setStoryBible(bible ?? null)
      story.setVerseTimelineEvents(verse)
      story.setCharacterProfiles([])
      story.setLocationProfiles([])
      story.setOrganizationProfiles([])
      story.setLoreEntries([])

      const state = useWorkspaceStore.getState()
      const cached = state.bookTabs[bookId]
      const matchingSession = session?.current_book_id === bookId ? session : null
      const availableTabs: EditorTab[] = [
        ...chapters.map((item) => ({ id: item.id, type: 'chapter' as const, title: item.title })),
        ...characters.map((item) => ({ id: item.id, type: 'character' as const, title: item.name })),
        ...locations.map((item) => ({ id: item.id, type: 'location' as const, title: item.name })),
        ...notes.map((item) => ({ id: item.id, type: 'note' as const, title: item.title })),
        ...codex.map((item) => ({ id: item.id, type: 'codex' as const, title: item.title })),
        ...wiki.map((item) => ({ id: item.id, type: 'wiki' as const, title: item.title })),
        ...organizations.map((item) => ({ id: item.id, type: 'organization' as const, title: item.title })),
        ...rules.map((item) => ({ id: item.id, type: 'world_rule' as const, title: item.title })),
        { id: `maps-${bookId}`, type: 'maps', title: 'Maps' },
        { id: `calendar-${bookId}`, type: 'timeline', title: 'Calendar' },
        { id: bookId, type: 'story_intelligence', title: 'Story Intelligence' },
        { id: 'relationships', type: 'relationship_manager', title: 'Relationships' },
        { id: 'verse_timeline', type: 'verse_timeline', title: 'Timeline Record' }
      ].map((tab) => ({ ...tab, entityId: tab.id, isDirty: false } as EditorTab))

      let savedIds: string[] = []
      if (matchingSession && !cached) {
        try {
          const value: unknown = JSON.parse(matchingSession.open_tabs)
          if (Array.isArray(value)) savedIds = value.filter((id): id is string => typeof id === 'string')
        } catch {}
      }
      const byId = new Map(availableTabs.map((tab) => [tab.id, tab]))
      const restoredTabs = (cached?.tabs.map((tab) => tab.id) ?? savedIds)
        .flatMap((id) => {
          const tab = byId.get(id)
          return tab ? [{ ...tab, isDirty: cached?.tabs.find((source) => source.id === id)?.isDirty ?? false }] : []
        })
      const savedActiveId = cached ? cached.activeTabId : matchingSession?.current_chapter_id
      const routeTab = chapterId ? byId.get(chapterId) : undefined
      if (routeTab && !restoredTabs.some((tab) => tab.id === routeTab.id)) {
        restoredTabs.push({ ...routeTab, isDirty: false })
      }
      workspace.setTabs(restoredTabs)
      workspace.setActiveTabId(
        routeTab?.id ?? restoredTabs.find((tab) => tab.id === savedActiveId)?.id ?? restoredTabs.at(-1)?.id ?? null
      )

      Promise.all([
        Promise.all(characters.map((item) => window.api.characterProfiles.getByCharacter(item.id))),
        Promise.all(locations.map((item) => window.api.locationProfiles.getByLocation(item.id))),
        Promise.all(organizations.map((item) => window.api.organizationProfiles.getByOrganization(item.id))),
        Promise.all(codex.map((item) => window.api.loreEntries.getByCodex(item.id)))
      ]).then(([characterProfiles, locationProfiles, organizationProfiles, entries]) => {
        if (useWorkspaceStore.getState().currentBook !== book) return
        story.setCharacterProfiles(characterProfiles.flatMap((profile) => profile ? [profile] : []))
        story.setLocationProfiles(locationProfiles.flatMap((profile) => profile ? [profile] : []))
        story.setOrganizationProfiles(organizationProfiles.flatMap((profile) => profile ? [profile] : []))
        story.setLoreEntries(entries.flatMap((entry) => entry ? [entry] : []))
      }).catch((error) => console.error('Failed to load story profiles:', error))
    }

    load().catch((error) => {
      console.error('Failed to load workspace:', error)
      if (!cancelled && bookId !== workspace.currentBook?.id) workspace.setCurrentBook(null)
    }).finally(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [user?.id, bookId, chapterId])

  useEffect(() => {
    if (!user || isLoading || !bookId || currentBook?.id !== bookId) return
    window.api.editor.saveWorkspaceState({
      userId: user.id,
      currentBookId: bookId,
      currentChapterId: activeTabId,
      openTabs: JSON.parse(openTabIds) as string[],
      panelState,
    }).catch((error) => console.error('Failed to save workspace:', error))
  }, [user?.id, isLoading, bookId, currentBook?.id, activeTabId, openTabIds, panelState])

  if (isLoading || (bookId && currentBook && currentBook.id !== bookId)) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-950">
        <div className="h-5 w-5 rounded-full border-2 border-accent-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {bookId && currentBook ? <EditorView key={currentBook.id} /> : <Dashboard />}
    </div>
  )
}
