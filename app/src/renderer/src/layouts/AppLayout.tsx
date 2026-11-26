import { useEffect, useState } from 'react'
import { Outlet, useMatch } from 'react-router-dom'
import TitleBar from '../components/ui/TitleBar'
import { useWorkspaceStore } from '../stores/workspaceStore'
import Sidebar from '../components/layout/Sidebar'
import AIPanel from '../components/ai/AIPanel'
import SearchModal from '../components/ui/SearchModal'
import { cn } from '../utils'

export default function AppLayout() {
  const { panelState, focusMode, mapEditorFocused, currentBook } = useWorkspaceStore()
  const isMaps = useWorkspaceStore(state => state.tabs.some(tab => tab.id === state.activeTabId && tab.type === 'maps'))
  const workspaceRoot = useMatch('/')
  const studio = useMatch('/ai-chat')
  const route = useMatch('/book/:bookId/*')
  const searchableBook = currentBook && (workspaceRoot || route?.params.bookId === currentBook.id)
    ? currentBook
    : null
  const [searchBookId, setSearchBookId] = useState<string | null>(null)
  const bookId = mapEditorFocused ? undefined : searchableBook?.id

  useEffect(() => {
    if (!bookId) return
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchBookId(bookId)
      }
    }
    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [bookId])

  useEffect(() => {
    setSearchBookId(null)
  }, [bookId])
  
  // AI Panel should only be accessible when actively writing in a book
  const isEditorRoute = currentBook !== null

  return (
    <div className="flex flex-col h-full bg-surface-950 overflow-hidden">
      {/* Custom title bar */}
      <TitleBar onSearch={bookId ? () => setSearchBookId(bookId) : undefined} />
      {window.api.isMock && (
        <p role="status" className="shrink-0 border-b border-surface-800 bg-surface-850 px-4 py-2 text-sm text-surface-200">
          Browser preview. Open the Write Your Thoughts desktop window to access your saved books.
        </p>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          hidden={mapEditorFocused}
          className={cn(
            'panel-transition overflow-hidden flex-shrink-0',
            panelState.sidebarOpen && !focusMode && !mapEditorFocused ? 'w-60' : 'w-0 opacity-0'
          )}
        >
          <Sidebar />
        </div>

        {/* Editor area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>

        {/* AI Panel */}
        <div
          className={cn(
            'panel-transition overflow-hidden flex-shrink-0 border-l',
            (panelState.aiPanelOpen && !focusMode && isEditorRoute && !isMaps && !studio)
              ? 'w-80 border-surface-800' 
              : 'w-0 opacity-0 border-transparent'
          )}
        >
          <AIPanel />
        </div>
      </div>

      {!mapEditorFocused && searchableBook && searchBookId === searchableBook.id && (
        <SearchModal book={searchableBook} onClose={() => setSearchBookId(null)} />
      )}
    </div>
  )
}
