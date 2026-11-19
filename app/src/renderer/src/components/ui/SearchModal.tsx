import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, BookOpen, Clock, FileText, MapPin, Search, StickyNote, Users, X } from 'lucide-react'
import { MAX_SEARCH_LENGTH } from '../../../../shared/manuscriptSearch'
import type { SearchResult, SearchResultType, SearchTarget } from '../../../../shared/manuscriptSearch'
import { useWorkspaceStore } from '../../stores/workspaceStore'
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
  timeline: { label: 'Timeline event', Icon: Clock },
} satisfies Record<SearchResultType, { label: string; Icon: typeof FileText }>

const filters = ['All', 'Chapters', 'Worldbuilding'] as const
type SearchFilter = typeof filters[number]

type SearchResponse = { term: string; results: SearchResult[] | null }

interface SearchModalProps {
  book: Pick<Book, 'id' | 'title'>
  onClose: () => void
}

export default function SearchModal({ book, onClose }: SearchModalProps) {
  const openTab = useWorkspaceStore(state => state.openTab)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SearchFilter>('All')
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const term = query.trim()

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
    if (!term) return

    let cancelled = false
    const timeout = window.setTimeout(async () => {
      try {
        const results: SearchResult[] = await window.api.search.global({ bookId: book.id, query: term })
        if (!cancelled) setResponse({ term, results })
      } catch (error) {
        console.error('Manuscript search failed', error)
        if (!cancelled) setResponse({ term, results: null })
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [book.id, term])

  const currentResponse = response?.term === term ? response : null
  const results = currentResponse?.results ?? []
  const chapterCount = results.filter(result => result.type === 'chapter').length
  const counts = { All: results.length, Chapters: chapterCount, Worldbuilding: results.length - chapterCount }
  const visibleResults = results.filter(result =>
    filter === 'All' || (filter === 'Chapters' ? result.type === 'chapter' : result.type !== 'chapter')
  )

  const handleSelect = (result: SearchResult) => {
    onClose()
    if (result.type === 'timeline') {
      openTab(book.id, 'timeline', 'Calendar', { type: 'timeline', eventId: result.id })
      return
    }

    const target: SearchTarget | undefined = result.hasPassage
      ? { type: 'chapter', chapterId: result.id, query: term }
      : undefined
    openTab(result.id, result.type, result.title, target)
  }

  let status: string | undefined
  if (!term) status = 'Search saved chapters and worldbuilding records in this book.'
  else if (!currentResponse) status = 'Searching…'
  else if (!currentResponse.results) status = 'Search failed. Change your query to try again.'
  else if (results.length === 0) status = 'No matches in this book.'
  else if (visibleResults.length === 0) status = 'No matches in this category.'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="manuscript-search-title"
      onCancel={event => {
        event.preventDefault()
        onClose()
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
      className="top-[12vh] mx-auto my-0 max-h-[76vh] w-11/12 max-w-2xl overflow-hidden rounded-xl border border-surface-700 bg-surface-900 text-surface-100 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[76vh] flex-col">
        <header className="flex items-center justify-between gap-4 px-5 pt-4">
          <div className="min-w-0">
            <h2 id="manuscript-search-title" className="text-base font-semibold">Manuscript search</h2>
            <p className="truncate text-xs text-surface-400">{book.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close manuscript search"
            className="rounded-md p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="mx-5 my-4 flex items-center gap-3 rounded-lg border border-surface-700 bg-surface-950 px-3 focus-within:border-accent-500">
          <Search className="h-4 w-4 shrink-0 text-surface-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            aria-label="Search term or phrase"
            maxLength={MAX_SEARCH_LENGTH}
            value={query}
            onChange={event => {
              const nextQuery = event.target.value
              if (nextQuery.trim() !== term) setResponse(null)
              setQuery(nextQuery)
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing && visibleResults[0]) {
                event.preventDefault()
                handleSelect(visibleResults[0])
              }
            }}
            placeholder="Search for a name, place, or phrase"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm placeholder:text-surface-500 focus:outline-none"
          />
          <kbd className="rounded border border-surface-700 px-1.5 py-0.5 text-[10px] text-surface-400">Esc</kbd>
        </div>

        {results.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-surface-800 px-5 pb-3" role="group" aria-label="Filter search results">
            {filters.map(option => (
              <button
                key={option}
                type="button"
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${filter === option
                  ? 'bg-accent-500/15 text-accent-400'
                  : 'text-surface-400 hover:bg-surface-800 hover:text-surface-100'}`}
              >
                {option} <span className="ml-1 tabular-nums">{counts[option]}</span>
              </button>
            ))}
          </div>
        )}

        {status ? (
          <p role="status" className="border-t border-surface-800 px-5 py-8 text-center text-sm text-surface-400">
            {status}
          </p>
        ) : (
          <ul className="min-h-0 overflow-y-auto divide-y divide-surface-800">
            {visibleResults.map(result => {
              const { label, Icon } = resultTypes[result.type]
              const { before, match, after } = result.snippet
              return (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    type="button"
                    onClick={() => handleSelect(result)}
                    className="group flex w-full items-start gap-3 px-5 py-3 text-left hover:bg-surface-800 focus-visible:bg-surface-800 focus-visible:outline-none"
                  >
                    <span className="mt-0.5 rounded-md bg-accent-500/10 p-2 text-accent-400">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{result.title}</span>
                      <span className="mt-0.5 block break-words text-sm text-surface-400">
                        {before}<mark className="rounded-sm bg-accent-500/20 text-surface-100">{match}</mark>{after}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-surface-400">
                      <span className="flex items-center justify-end gap-1.5">
                        {label}
                        <ArrowUpRight className="h-3 w-3 text-surface-500 group-hover:text-accent-400" aria-hidden="true" />
                      </span>
                      <span className="mt-1 block tabular-nums">{result.matchCount} {result.matchCount === 1 ? 'match' : 'matches'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </dialog>
  )
}
