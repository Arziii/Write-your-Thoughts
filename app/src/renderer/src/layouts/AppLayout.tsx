import { useEffect, useState } from 'react'
import { Outlet, useMatch } from 'react-router-dom'
import TitleBar from '../components/ui/TitleBar'
import { useWorkspaceStore } from '../stores/workspaceStore'
import Sidebar from '../components/layout/Sidebar'
import SearchModal from '../components/ui/SearchModal'
import ResizeHandle from '../components/ui/ResizeHandle'
import { cn } from '../utils'

const SIDEBAR_STORAGE_KEY = 'wyt-sidebar-width'
const DEFAULT_SIDEBAR_WIDTH = 240
const MIN_SIDEBAR_WIDTH = 200
const MAX_SIDEBAR_WIDTH = 420

function clampSidebarWidth(width: number) {
  return Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.round(width)))
}

function readStoredSidebarWidth(): number {
  try {
    const saved = Number(localStorage.getItem(SIDEBAR_STORAGE_KEY))
    return Number.isFinite(saved) && saved >= MIN_SIDEBAR_WIDTH ? clampSidebarWidth(saved) : DEFAULT_SIDEBAR_WIDTH
  } catch {
    return DEFAULT_SIDEBAR_WIDTH
  }
}

export default function AppLayout() {
  const { panelState, focusMode, mapEditorFocused, currentBook, setPanelWidths } = useWorkspaceStore()
  const workspaceRoot = useMatch('/')
  const route = useMatch('/book/:bookId/*')
  const searchableBook = currentBook && (workspaceRoot || route?.params.bookId === currentBook.id)
    ? currentBook
    : null
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
    panelState.sidebarWidth ? clampSidebarWidth(panelState.sidebarWidth) : readStoredSidebarWidth()
  )
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    if (panelState.sidebarWidth && !resizing) {
      setSidebarWidth(clampSidebarWidth(panelState.sidebarWidth))
    }
  }, [panelState.sidebarWidth, resizing])

  useEffect(() => {
    if (mapEditorFocused) return
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(open => !open)
      }
    }
    window.addEventListener('keydown', handleSearchShortcut)
    return () => window.removeEventListener('keydown', handleSearchShortcut)
  }, [mapEditorFocused])

  useEffect(() => {
    if (mapEditorFocused) setPaletteOpen(false)
  }, [mapEditorFocused])

  const sidebarVisible = panelState.sidebarOpen && !focusMode && !mapEditorFocused

  const commitSidebarWidth = (width: number) => {
    const clamped = clampSidebarWidth(width)
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(clamped)) } catch {}
    setPanelWidths({ sidebarWidth: clamped })
  }

  return (
    <div className="flex flex-col h-full bg-surface-950 overflow-hidden">
      {/* Custom title bar */}
      <TitleBar onSearch={!mapEditorFocused ? () => setPaletteOpen(true) : undefined} />
      {window.api.isMock && (
        <p role="status" className="shrink-0 border-b border-[hsl(var(--studio-edge))] bg-surface-850 px-4 py-2 text-sm text-surface-200">
          Browser preview. Open the Write Your Thoughts desktop window to access your saved books.
        </p>
      )}

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Resizable Sidebar */}
        <div
          hidden={mapEditorFocused}
          style={{ width: sidebarVisible ? sidebarWidth : 0 }}
          className={cn(
            'overflow-hidden flex-shrink-0',
            !resizing && 'panel-transition',
            !sidebarVisible && 'opacity-0'
          )}
        >
          <Sidebar />
        </div>

        {sidebarVisible && (
          <ResizeHandle
            aria-label="Resize sidebar"
            onResize={delta => {
              setResizing(true)
              setSidebarWidth(current => clampSidebarWidth(current + delta))
            }}
            onResizeEnd={() => {
              setResizing(false)
              setSidebarWidth(current => {
                commitSidebarWidth(current)
                return current
              })
            }}
            onReset={() => {
              setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)
              commitSidebarWidth(DEFAULT_SIDEBAR_WIDTH)
            }}
          />
        )}

        {/* Primary workspace area */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <Outlet />
        </main>
      </div>

      {!mapEditorFocused && paletteOpen && (
        <SearchModal book={searchableBook} onClose={() => setPaletteOpen(false)} />
      )}
    </div>
  )
}
