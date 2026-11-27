import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUpRight, BookOpen, Brain, Building2, Clock, Command, Download,
  FileText, Focus, Gavel, Globe, Home, Map as MapIcon, MapPin, MessageSquare,
  Moon, Network, Search, Settings, StickyNote, Sun, Users, X
} from 'lucide-react'
import { MAX_SEARCH_LENGTH } from '../../../../shared/manuscriptSearch'
import type { SearchResult, SearchResultType, SearchTarget } from '../../../../shared/manuscriptSearch'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useOpenBookTab } from '../../hooks/useOpenBookTab'
import { cn } from '../../utils'
import type { Book } from '../../types'

const resultTypes = {
  chapter: { label: 'Chapter', Icon: FileText },
  character: { label: 'Character', Icon: Users },
  location: { label: 'Location', Icon: MapPin },
  wiki: { label: 'Wiki', Icon: BookOpen },
  note: { label: 'Note', Icon: StickyNote },
  codex: { label: 'Codex', Icon: BookOpen },
  organization: { label: 'Organization', Icon: Users },
  world_rule: { label: 'World rule', Icon: BookOpen },
  timeline: { label: 'Book Chronology', Icon: Clock },
} satisfies Record<SearchResultType, { label: string; Icon: typeof FileText }>

const filters = ['All', 'Chapters', 'Worldbuilding'] as const
type SearchFilter = typeof filters[number]

type SearchResponse = { term: string; results: SearchResult[] | null }

interface QuickEntry {
  key: string
  category: 'Jump' | 'Action'
  title: string
  subtitle: string
  Icon: typeof FileText
  run: () => void
}

interface SearchModalProps {
  book?: Pick<Book, 'id' | 'title'> | null
  onClose: () => void
}

export default function SearchModal({ book, onClose }: SearchModalProps) {
  const {
    books, currentBook, chapters, characters, locations, organizations,
    worldRules, codex, wiki, notes, openTab, focusMode, setFocusMode
  } = useWorkspaceStore()
  const { user, settings, setSettings } = useUserStore()
  const openBookTab = useOpenBookTab()
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SearchFilter>('All')
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const term = query.trim()
  const lowerTerm = term.toLowerCase()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    inputRef.current?.focus()
    return () => {
      dialog.close()
    }
  }, [])

  useEffect(() => {
    if (!term || !book) return

    let cancelled = false
    const timeout = window.setTimeout(async () => {
      try {
        const results: SearchResult[] = await window.api.search.global({ bookId: book.id, query: term })
        if (!cancelled) setResponse({ term, results })
      } catch (error) {
        console.error('Manuscript search failed', error)
        if (!cancelled) setResponse({ term, results: null })
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [book, term])

  const quickEntries = useMemo<QuickEntry[]>(() => {
    const entries: QuickEntry[] = []

    if (currentBook) {
      for (const ch of chapters) {
        entries.push({
          key: `jump-chapter-${ch.id}`,
          category: 'Jump',
          title: ch.title,
          subtitle: 'Chapter',
          Icon: FileText,
          run: () => openBookTab(ch.id, 'chapter', ch.title),
        })
      }
      for (const c of characters) {
        entries.push({
          key: `jump-char-${c.id}`,
          category: 'Jump',
          title: c.name,
          subtitle: 'Character',
          Icon: Users,
          run: () => openBookTab(c.id, 'character', c.name),
        })
      }
      for (const l of locations) {
        entries.push({
          key: `jump-loc-${l.id}`,
          category: 'Jump',
          title: l.name,
          subtitle: 'Location',
          Icon: MapPin,
          run: () => openBookTab(l.id, 'location', l.name),
        })
      }
      for (const o of organizations) {
        entries.push({
          key: `jump-org-${o.id}`,
          category: 'Jump',
          title: o.title,
          subtitle: 'Organization',
          Icon: Building2,
          run: () => openBookTab(o.id, 'organization', o.title),
        })
      }
      for (const w of worldRules) {
        entries.push({
          key: `jump-rule-${w.id}`,
          category: 'Jump',
          title: w.title,
          subtitle: 'World Rule',
          Icon: Gavel,
          run: () => openBookTab(w.id, 'world_rule', w.title),
        })
      }
      for (const c of codex) {
        entries.push({
          key: `jump-codex-${c.id}`,
          category: 'Jump',
          title: c.title,
          subtitle: 'Codex',
          Icon: BookOpen,
          run: () => openBookTab(c.id, 'codex', c.title),
        })
      }
      for (const w of wiki) {
        entries.push({
          key: `jump-wiki-${w.id}`,
          category: 'Jump',
          title: w.title,
          subtitle: 'Wiki',
          Icon: Globe,
          run: () => openBookTab(w.id, 'wiki', w.title),
        })
      }
      for (const n of notes) {
        entries.push({
          key: `jump-note-${n.id}`,
          category: 'Jump',
          title: n.title,
          subtitle: 'Note',
          Icon: StickyNote,
          run: () => openBookTab(n.id, 'note', n.title),
        })
      }
      entries.push(
        {
          key: 'jump-maps',
          category: 'Jump',
          title: 'Maps',
          subtitle: `${currentBook.title} · Atlas`,
          Icon: MapIcon,
          run: () => openBookTab(`maps-${currentBook.id}`, 'maps', 'Maps'),
        },
        {
          key: 'jump-relationships',
          category: 'Jump',
          title: 'Relationships',
          subtitle: `${currentBook.title} · Relationship Graph`,
          Icon: Network,
          run: () => openBookTab('relationships', 'relationship_manager', 'Relationships'),
        },
        {
          key: 'jump-verse-timeline',
          category: 'Jump',
          title: 'World History',
          subtitle: `${currentBook.title} · Verse Timeline`,
          Icon: Clock,
          run: () => openBookTab('verse_timeline', 'verse_timeline', 'World History'),
        },
        {
          key: 'jump-story-intel',
          category: 'Jump',
          title: 'Story Intelligence',
          subtitle: `${currentBook.title} · Book Analysis`,
          Icon: Brain,
          run: () => openBookTab(currentBook.id, 'story_intelligence', 'Story Intelligence'),
        }
      )
    }

    for (const b of books) {
      if (b.id === currentBook?.id) continue
      entries.push({
        key: `jump-book-${b.id}`,
        category: 'Jump',
        title: b.title,
        subtitle: 'Open Book',
        Icon: BookOpen,
        run: () => navigate(`/book/${b.id}`),
      })
    }

    if (currentBook) {
      entries.push(
        {
          key: 'action-focus',
          category: 'Action',
          title: focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode',
          subtitle: 'Hide sidebars and chrome',
          Icon: Focus,
          run: () => setFocusMode(!focusMode),
        },
        {
          key: 'action-export',
          category: 'Action',
          title: 'Export Book',
          subtitle: `Export ${currentBook.title} (PDF, DOCX, EPUB, Audiobook)`,
          Icon: Download,
          run: () => window.dispatchEvent(new CustomEvent('open-book-export')),
        }
      )
    }

    const currentTheme = settings?.theme === 'dark' ? 'dark' : 'light'
    entries.push(
      {
        key: 'action-theme',
        category: 'Action',
        title: currentTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
        subtitle: 'Appearance',
        Icon: currentTheme === 'dark' ? Sun : Moon,
        run: () => {
          const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'
          if (settings) setSettings({ ...settings, theme: nextTheme })
          if (user) void window.api.settings.update({ userId: user.id, theme: nextTheme }).catch(() => {})
        },
      },
      {
        key: 'action-dashboard',
        category: 'Action',
        title: 'Go to Dashboard',
        subtitle: 'Workspace home',
        Icon: Home,
        run: () => navigate('/'),
      },
      {
        key: 'action-aichat',
        category: 'Action',
        title: 'Open AI Chat',
        subtitle: 'Chat Studio',
        Icon: MessageSquare,
        run: () => navigate('/ai-chat'),
      },
      {
        key: 'action-settings',
        category: 'Action',
        title: 'Open Settings',
        subtitle: 'Profile, AI models, Read Aloud, Sync',
        Icon: Settings,
        run: () => navigate('/settings'),
      }
    )

    return entries
  }, [
    books, chapters, characters, codex, currentBook, focusMode, locations,
    navigate, notes, openBookTab, organizations, setFocusMode, setSettings,
    settings, user, wiki, worldRules,
  ])

  const filteredQuick = useMemo(() => {
    if (!lowerTerm) return quickEntries.slice(0, 8)
    return quickEntries
      .filter(entry =>
        entry.title.toLowerCase().includes(lowerTerm) ||
        entry.subtitle.toLowerCase().includes(lowerTerm)
      )
      .slice(0, 10)
  }, [lowerTerm, quickEntries])

  const currentResponse = response?.term === term ? response : null
  const results = currentResponse?.results ?? []
  const chapterCount = results.filter(result => result.type === 'chapter').length
  const counts = { All: results.length, Chapters: chapterCount, Worldbuilding: results.length - chapterCount }
  const visibleResults = book && term
    ? results.filter(result => filter === 'All' || (filter === 'Chapters' ? result.type === 'chapter' : result.type !== 'chapter'))
    : []

  const totalSelectable = filteredQuick.length + visibleResults.length

  useEffect(() => {
    setActiveIndex(0)
  }, [term, filter, filteredQuick.length, visibleResults.length])

  const handleSelectResult = (result: SearchResult) => {
    onClose()
    if (result.type === 'timeline' && book) {
      openTab(`calendar-${book.id}`, 'timeline', 'Book Chronology', { type: 'timeline', eventId: result.id })
      return
    }
    const target: SearchTarget | undefined = result.hasPassage
      ? { type: 'chapter', chapterId: result.id, query: term }
      : undefined
    openTab(result.id, result.type, result.title, target)
  }

  const runSelected = (index: number) => {
    if (index < filteredQuick.length) {
      const item = filteredQuick[index]
      if (item) { onClose(); item.run() }
      return
    }
    const result = visibleResults[index - filteredQuick.length]
    if (result) handleSelectResult(result)
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="manuscript-search-title"
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
      className="top-[10vh] mx-auto my-0 max-h-[78vh] w-11/12 max-w-2xl overflow-hidden rounded-xl border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] text-surface-100 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[78vh] flex-col">
        <header className="flex items-center justify-between gap-4 px-5 pt-4">
          <div className="min-w-0 flex items-center gap-2">
            <Command className="h-4 w-4 text-[hsl(var(--brand-green))]" aria-hidden="true" />
            <div>
              <h2 id="manuscript-search-title" className="text-sm font-semibold">
                {book ? 'Command Palette & Manuscript Search' : 'Command Palette'}
              </h2>
              {book && <p className="truncate text-xs text-surface-400">{book.title}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search and command palette"
            className="rounded-md p-1.5 text-surface-400 hover:bg-surface-850 hover:text-surface-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="mx-5 my-3 flex items-center gap-3 rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-950 px-3 focus-within:border-[hsl(var(--brand-green))]">
          <Search className="h-4 w-4 shrink-0 text-surface-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            aria-label="Search manuscript or jump to a command"
            maxLength={MAX_SEARCH_LENGTH}
            value={query}
            onChange={event => {
              const nextQuery = event.target.value
              if (nextQuery.trim() !== term) setResponse(null)
              setQuery(nextQuery)
            }}
            onKeyDown={event => {
              if (event.key === 'ArrowDown' && totalSelectable > 0) {
                event.preventDefault()
                setActiveIndex(i => (i + 1) % totalSelectable)
              } else if (event.key === 'ArrowUp' && totalSelectable > 0) {
                event.preventDefault()
                setActiveIndex(i => (i - 1 + totalSelectable) % totalSelectable)
              } else if (event.key === 'Enter' && !event.nativeEvent.isComposing && totalSelectable > 0) {
                event.preventDefault()
                runSelected(activeIndex)
              }
            }}
            placeholder={book ? 'Jump to chapter, character, command, or search manuscript text…' : 'Jump to a book, page, or action…'}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm placeholder:text-surface-500 focus:outline-none"
          />
          <kbd className="rounded border border-[hsl(var(--studio-edge))] px-1.5 py-0.5 text-[10px] text-surface-400">Esc</kbd>
        </div>

        {book && results.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[hsl(var(--studio-edge))] px-5 pb-2.5" role="group" aria-label="Filter search results">
            {filters.map(option => (
              <button
                key={option}
                type="button"
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === option
                    ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                    : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100'
                )}
              >
                {option} <span className="ml-1 tabular-nums">{counts[option]}</span>
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-[hsl(var(--studio-edge))]">
          {filteredQuick.length > 0 && (
            <section aria-label="Quick jump and actions" className="py-1">
              <p className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-surface-400">
                {term ? 'Quick Jump & Actions' : 'Suggested'}
              </p>
              <ul>
                {filteredQuick.map((entry, idx) => {
                  const Icon = entry.Icon
                  const isActive = idx === activeIndex
                  return (
                    <li key={entry.key}>
                      <button
                        type="button"
                        onClick={() => { onClose(); entry.run() }}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={cn(
                          'flex w-full items-center gap-3 px-5 py-2 text-left transition-colors',
                          isActive ? 'bg-[hsl(var(--brand-green-bg)/0.65)]' : 'hover:bg-surface-850'
                        )}
                      >
                        <span className="rounded-md bg-[hsl(var(--brand-green-bg))] p-1.5 text-[hsl(var(--brand-green))]">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-surface-100">{entry.title}</span>
                          <span className="block truncate text-xs text-surface-400">{entry.subtitle}</span>
                        </span>
                        <span className="rounded border border-[hsl(var(--studio-edge))] px-1.5 py-0.5 text-[10px] text-surface-400">
                          {entry.category}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {book && term && (
            <section aria-label="Manuscript text matches" className="py-1">
              <p className="px-5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-surface-400">
                Manuscript & Lore Matches
              </p>
              {!currentResponse ? (
                <p role="status" className="px-5 py-4 text-xs text-surface-400">Searching…</p>
              ) : !currentResponse.results ? (
                <p role="status" className="px-5 py-4 text-xs text-surface-400">Search failed. Change your query to try again.</p>
              ) : visibleResults.length === 0 ? (
                <p role="status" className="px-5 py-4 text-xs text-surface-400">
                  {results.length === 0 ? 'No full-text matches in this book.' : 'No matches in this category.'}
                </p>
              ) : (
                <ul className="divide-y divide-[hsl(var(--studio-edge))]">
                  {visibleResults.map((result, idx) => {
                    const globalIdx = filteredQuick.length + idx
                    const isActive = globalIdx === activeIndex
                    const { label, Icon } = resultTypes[result.type]
                    const { before, match, after } = result.snippet
                    return (
                      <li key={`${result.type}-${result.id}`}>
                        <button
                          type="button"
                          onClick={() => handleSelectResult(result)}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                          className={cn(
                            'group flex w-full items-start gap-3 px-5 py-2.5 text-left transition-colors',
                            isActive ? 'bg-[hsl(var(--brand-green-bg)/0.65)]' : 'hover:bg-surface-850'
                          )}
                        >
                          <span className="mt-0.5 rounded-md bg-[hsl(var(--brand-green-bg))] p-1.5 text-[hsl(var(--brand-green))]">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{result.title}</span>
                            <span className="mt-0.5 block break-words text-xs text-surface-400">
                              {before}<mark className="rounded-sm bg-[hsl(var(--brand-green-bg))] text-surface-50">{match}</mark>{after}
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-xs text-surface-400">
                            <span className="flex items-center justify-end gap-1">
                              {label}
                              <ArrowUpRight className="h-3 w-3 text-surface-500" aria-hidden="true" />
                            </span>
                            <span className="mt-0.5 block tabular-nums">{result.matchCount} {result.matchCount === 1 ? 'match' : 'matches'}</span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}

          {totalSelectable === 0 && !(book && term) && (
            <p role="status" className="px-5 py-8 text-center text-sm text-surface-400">
              No matching commands or items.
            </p>
          )}
        </div>
      </div>
    </dialog>
  )
}
