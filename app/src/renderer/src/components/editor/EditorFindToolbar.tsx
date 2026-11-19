import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Editor } from '@tiptap/react'
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react'
import { createSearchPattern } from '../../../../shared/manuscriptSearch'
import { useWorkspaceStore } from '../../stores/workspaceStore'

interface EditorFindToolbarProps {
  editor: Editor | null
  chapterId?: string
}

function scrollToCurrent(editor: Editor | null) {
  requestAnimationFrame(() => {
    if (!editor || editor.isDestroyed) return
    editor.view.dom.querySelector('.search-result-current')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  })
}

export default function EditorFindToolbar({ editor, chapterId }: EditorFindToolbarProps) {
  const searchTarget = useWorkspaceStore(state => chapterId ? state.searchTarget : null)
  const clearSearchTarget = useWorkspaceStore(state => state.clearSearchTarget)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [resultCount, setResultCount] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editor || searchTarget?.type !== 'chapter' || searchTarget.chapterId !== chapterId) return
    setSearchTerm(searchTarget.query)
    setIsOpen(true)
    editor.commands.resetIndex()
    scrollToCurrent(editor)
    clearSearchTarget(searchTarget)
  }, [editor, chapterId, searchTarget, clearSearchTarget])

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
      if (e.key === 'Escape' && isOpen && !document.querySelector('dialog[open]')) {
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
      editor.commands.setSearchTerm('')
    }
  }, [isOpen, editor])

  useEffect(() => {
    if (editor && isOpen) {
      const query = searchTerm.trim()
      // The chapter extension accepts the same escaped pattern as manuscript search.
      const term = chapterId ? (query ? createSearchPattern(query).source : '') : searchTerm
      editor.chain().resetIndex().setSearchTerm(term).run()
      scrollToCurrent(editor)
    }
  }, [searchTerm, editor, isOpen, chapterId])

  if (!isOpen) return null
  const headerSlot = document.getElementById('editor-find-slot')

  const handleNext = () => {
    editor?.commands.nextSearchResult()
    scrollToCurrent(editor)
  }

  const handlePrev = () => {
    editor?.commands.previousSearchResult()
    scrollToCurrent(editor)
  }

  const toolbar = (
    <div className={`flex items-center bg-surface-800 border border-surface-700 rounded-md px-1 animate-fade-in ${headerSlot ? '' : 'absolute top-4 right-8 z-50 shadow-lg'}`}>
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
        className="bg-transparent text-sm text-surface-100 placeholder-surface-500 border-none focus:outline-none focus:ring-0 w-40 min-w-16 shrink px-2"
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
  return headerSlot ? createPortal(toolbar, headerSlot) : toolbar
}
