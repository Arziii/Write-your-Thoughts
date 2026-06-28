import { useState, useEffect, useRef } from 'react'
import { Editor } from '@tiptap/react'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'

interface EditorFindToolbarProps {
  editor: Editor | null
}

export default function EditorFindToolbar({ editor }: EditorFindToolbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [resultCount, setResultCount] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editor) return

    const updateCounts = () => {
      if (!editor.storage.searchAndReplace) return
      const results = editor.storage.searchAndReplace.results || []
      const index = editor.storage.searchAndReplace.resultIndex || 0
      
      const count = results.length
      const current = count > 0 ? index + 1 : 0

      setResultCount(prev => prev === count ? prev : count)
      setCurrentIndex(prev => prev === current ? prev : current)
    }

    editor.on('transaction', updateCounts)
    updateCounts()

    return () => {
      editor.off('transaction', updateCounts)
    }
  }, [editor])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        editor?.commands.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, editor])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    } else if (!isOpen && editor) {
      // @ts-ignore - Commands from extension
      editor.commands.setSearchTerm('')
    }
  }, [isOpen, editor])

  useEffect(() => {
    if (editor && isOpen) {
      // @ts-ignore - Commands from extension
      editor.commands.setSearchTerm(searchTerm)
      scrollToCurrent()
    }
  }, [searchTerm, editor, isOpen])

  if (!isOpen) return null

  const scrollToCurrent = () => {
    setTimeout(() => {
      const el = document.querySelector('.search-result-current')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 10)
  }

  const handleNext = () => {
    // @ts-ignore
    editor?.commands.nextSearchResult()
    scrollToCurrent()
  }

  const handlePrev = () => {
    // @ts-ignore
    editor?.commands.previousSearchResult()
    scrollToCurrent()
  }

  return (
    <div className="absolute top-4 right-8 z-50 flex items-center bg-surface-800 border border-surface-700 rounded-md shadow-lg p-1 animate-fade-in">
      <Search className="w-4 h-4 text-surface-400 ml-2 mr-1" />
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            if (e.shiftKey) handlePrev()
            else handleNext()
          }
        }}
        placeholder="Find..."
        className="bg-transparent text-sm text-surface-100 placeholder-surface-500 border-none focus:outline-none focus:ring-0 w-40 px-2"
      />
      {searchTerm && (
        <span className="text-xs text-surface-400 whitespace-nowrap pr-2 select-none">
          {resultCount > 0 ? `${currentIndex} of ${resultCount}` : '0 of 0'}
        </span>
      )}
      <div className="flex items-center border-l border-surface-700 pl-1">
        <button onClick={handlePrev} title="Previous (Shift+Enter)" className="p-1.5 text-surface-400 hover:text-surface-100 hover:bg-surface-700 rounded transition-colors">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button onClick={handleNext} title="Next (Enter)" className="p-1.5 text-surface-400 hover:text-surface-100 hover:bg-surface-700 rounded transition-colors">
          <ChevronDown className="w-4 h-4" />
        </button>
        <button onClick={() => { setIsOpen(false); editor?.commands.focus() }} title="Close (Esc)" className="p-1.5 text-surface-400 hover:text-accent-400 hover:bg-surface-700 rounded transition-colors ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
