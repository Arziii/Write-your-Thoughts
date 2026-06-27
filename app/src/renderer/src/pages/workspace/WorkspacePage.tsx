import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import Dashboard from './Dashboard'
import EditorView from './EditorView'
import type { Book, Chapter, WorkspaceState } from '../../types'

export default function WorkspacePage() {
  const { bookId, chapterId } = useParams()
  const { user } = useUserStore()
  const {
    activeTabId, currentBook, setCurrentBook, setChapters,
    setCharacters, setLocations, setNotes, setTimelineEvents,
    setTimelineSettings,
    setCodex,
    setWiki,
    setOrganizations, setWorldRules,
    openTab, setPanelState
  } = useWorkspaceStore()
  const { setStoryBible, setCharacterProfiles, setLocationProfiles, setOrganizationProfiles, setLoreEntries, setVerseTimelineEvents } = useStoryBibleStore()
  const navigate = useNavigate()
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  // On mount: restore session from workspace state
  useEffect(() => {
    if (!user) return
    restoreSession()
  }, [user?.id])

  // When route params change, load the book/chapter
  useEffect(() => {
    if (!user || !bookId || isRestoringSession) return
    loadBookAndChapter(bookId, chapterId)
  }, [bookId, chapterId])

  async function restoreSession() {
    if (!user) return
    try {
      const state = await window.api.editor.getWorkspaceState(user.id) as WorkspaceState | null

      if (state) {
        // Restore panel state
        try {
          const ps = JSON.parse(state.panel_state)
          setPanelState(ps)
        } catch {}

        // Restore open book
        if (state.current_book_id && !bookId) {
          await loadBookAndChapter(state.current_book_id, state.current_chapter_id ?? undefined)
          if (state.current_book_id) {
            navigate(`/book/${state.current_book_id}`, { replace: true })
          }
        } else if (bookId) {
          await loadBookAndChapter(bookId, chapterId)
        }

        // Restore tabs
        if (state.open_tabs) {
          try {
            const tabIds = JSON.parse(state.open_tabs) as string[]
            // Tabs will be populated as chapters load
          } catch {}
        }
      } else if (bookId) {
        await loadBookAndChapter(bookId, chapterId)
      }
    } catch (err) {
      console.error('Session restore failed:', err)
    } finally {
      setIsRestoringSession(false)
    }
  }

  async function loadBookAndChapter(bId: string, cId?: string) {
    try {
      const book = await window.api.books.getById(bId)
      if (!book) return
      setCurrentBook(book as Book)

      const chapters = await window.api.chapters.getByBook(bId)
      setChapters(chapters as Chapter[])

      try {
        const characters = await window.api.characters.getByBook(bId)
        setCharacters(characters as any[])
      } catch (e) { console.error('Failed to load characters:', e) }

      try {
        const locations = await window.api.locations.getByBook(bId)
        setLocations(locations as any[])
      } catch (e) { console.error('Failed to load locations:', e) }

      try {
        const notes = await window.api.notes.getByBook(bId)
        setNotes(notes as any[])
      } catch (e) { console.error('Failed to load notes:', e) }

      try {
        const timelineEvents = await window.api.timelineEvents.getByBook(bId)
        setTimelineEvents(timelineEvents as any[])

        const verseTimelineEvents = await window.api.verseTimeline.getByBook(bId)
        setVerseTimelineEvents(verseTimelineEvents as any[])
      } catch (e) { console.error('Failed to load timeline:', e) }

      try {
        const timelineSettings = await window.api.timelineSettings.get(bId)
        setTimelineSettings(timelineSettings as any)
      } catch (e) { console.error('Failed to load timeline settings:', e) }

      try {
        const codexItems = await window.api.codex.getByBook(bId)
        setCodex(codexItems as any[])
      } catch (e) { console.error('Failed to load codex:', e) }

      try {
        const wikiItems = await window.api.wiki.getByBook(bId)
        setWiki(wikiItems as any[])
      } catch (e) { console.error('Failed to load wiki:', e) }

      try {
        const orgItems = await window.api.organizations.getByBook(bId)
        setOrganizations(orgItems as any[])
      } catch (e) { console.error('Failed to load organizations:', e) }

      try {
        const rulesItems = await window.api.worldRules.getByBook(bId)
        setWorldRules(rulesItems as any[])
      } catch (e) { console.error('Failed to load world rules:', e) }

      // Fetch AI Profiles
      try {
        const bible = await window.api.storyBible.getByBook(bId)
        setStoryBible(bible as any || null)
      } catch (e) { console.error('Failed to load story bible:', e) }

      try {
        const chars = await window.api.characters.getByBook(bId)
        if (chars?.length) {
          Promise.all((chars as any[]).map((c: any) => window.api.characterProfiles.getByCharacter(c.id)))
            .then(profiles => setCharacterProfiles(profiles.filter(Boolean) as any))
            .catch(e => console.error('Failed to load character profiles:', e))
        }
      } catch (e) {}

      try {
        const locs = await window.api.locations.getByBook(bId)
        if (locs?.length) {
          Promise.all(locs.map((l: any) => window.api.locationProfiles.getByLocation(l.id)))
            .then(profiles => setLocationProfiles(profiles.filter(Boolean) as any))
            .catch(e => console.error('Failed to load location profiles:', e))
        }
      } catch (e) {}

      try {
        const orgs = await window.api.organizations.getByBook(bId)
        if (orgs?.length) {
          Promise.all(orgs.map((o: any) => window.api.organizationProfiles.getByOrganization(o.id)))
            .then(profiles => setOrganizationProfiles(profiles.filter(Boolean) as any))
            .catch(e => console.error('Failed to load organization profiles:', e))
        }
      } catch (e) {}

      try {
        const codexEntries = await window.api.codex.getByBook(bId)
        if (codexEntries?.length) {
          Promise.all(codexEntries.map((c: any) => window.api.loreEntries.getByCodex(c.id)))
            .then(entries => setLoreEntries(entries.filter(Boolean) as any))
            .catch(e => console.error('Failed to load lore entries:', e))
        }
      } catch (e) {}

      if (cId) {
        const chapter = (chapters as Chapter[]).find((c) => c.id === cId)
        if (chapter) {
          openTab(chapter.id, 'chapter', chapter.title)
        }
      }
    } catch (err) {
      console.error('Failed to load book:', err)
    }
  }

  // Save workspace state when book/tab changes
  useEffect(() => {
    if (!user || isRestoringSession) return
    const { tabs, panelState } = useWorkspaceStore.getState()

    window.api.editor.saveWorkspaceState({
      userId: user.id,
      currentBookId: currentBook?.id ?? null,
      currentChapterId: activeTabId ?? null,
      openTabs: tabs.map((t) => t.id),
      panelState,
    })
  }, [currentBook?.id, activeTabId])

  if (isRestoringSession) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-950">
        <div className="h-5 w-5 rounded-full border-2 border-accent-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {currentBook ? <EditorView /> : <Dashboard />}
    </div>
  )
}
