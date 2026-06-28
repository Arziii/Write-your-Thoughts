import { useState, useEffect, useRef } from 'react'
import { Search, FileText, Users, MapPin, StickyNote, Clock } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { debounce } from '../../utils'

interface SearchResult {
  id: string
  type: 'chapter' | 'character' | 'location' | 'note' | 'timeline'
  title: string
  preview: string
}

export default function SearchModal() {
  const { currentBook, openTab } = useWorkspaceStore()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (currentBook) {
          setIsOpen(true)
        }
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentBook, isOpen])

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  const performSearch = useRef(
    debounce(async (q: string, bookId: string) => {
      if (!q.trim()) {
        setResults([])
        setIsSearching(false)
        return
      }
      setIsSearching(true)
      try {
        const res = await window.api.search.global({ bookId, query: q })
        setResults(res as SearchResult[])
      } catch (err) {
        console.error('Search failed', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)
  ).current

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    if (currentBook) {
      performSearch(q, currentBook.id)
    }
  }

  const handleSelect = (result: SearchResult) => {
    openTab(result.id, result.type, result.title)
    setIsOpen(false)
  }

  if (!isOpen) return null

  const getIcon = (type: string) => {
    switch (type) {
      case 'chapter': return <FileText className="w-4 h-4" />
      case 'character': return <Users className="w-4 h-4" />
      case 'location': return <MapPin className="w-4 h-4" />
      case 'note': return <StickyNote className="w-4 h-4" />
      case 'timeline': return <Clock className="w-4 h-4" />
      default: return <FileText className="w-4 h-4" />
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      
      <div className="relative w-full max-w-2xl bg-surface-900 border border-surface-700 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <div className="flex items-center px-4 py-3 border-b border-surface-800">
          <Search className="w-5 h-5 text-surface-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            placeholder="Search all files, characters, locations... (Esc to close)"
            className="flex-1 bg-transparent text-surface-100 placeholder-surface-500 text-lg focus:outline-none focus:ring-0"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim() === '' ? (
            <div className="px-6 py-8 text-center text-surface-500 text-sm">
              Start typing to search across your entire workspace.
            </div>
          ) : isSearching ? (
            <div className="px-6 py-8 text-center text-surface-500 text-sm">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-6 py-8 text-center text-surface-500 text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className="w-full text-left px-4 py-3 hover:bg-surface-800/80 transition-colors flex items-start gap-4"
                >
                  <div className="mt-0.5 text-accent-500 bg-accent-500/10 p-1.5 rounded-md">
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-surface-100 font-medium truncate">{result.title}</div>
                    <div className="text-surface-400 text-sm truncate">{result.preview}</div>
                  </div>
                  <div className="text-surface-600 text-[10px] uppercase tracking-wider font-semibold pt-1">
                    {result.type}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
