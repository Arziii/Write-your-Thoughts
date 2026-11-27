import { useSyncExternalStore } from 'react'
import { Minus, Square, X, PanelLeft, Search, Wifi, WifiOff } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn } from '../../utils'
import LogoImage from '../../assets/Logo.ico'
import CloudSyncStatus from './CloudSyncStatus'

function subscribeToNetwork(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const getNetworkStatus = () => navigator.onLine

export default function TitleBar({ onSearch }: { onSearch?: () => void }) {
  const { currentBook, activeChapter, panelState, toggleSidebar } = useWorkspaceStore()
  const location = useLocation()
  const isEditorRoute = location.pathname.startsWith('/book')
  const isOnline = useSyncExternalStore(subscribeToNetwork, getNetworkStatus)
  const NetworkIcon = isOnline ? Wifi : WifiOff

  const title = isEditorRoute
    ? (activeChapter
      ? `${activeChapter.title} — ${currentBook?.title ?? ''}`
      : currentBook
        ? currentBook.title
        : 'Write Your Thoughts')
    : 'Write Your Thoughts'

  return (
    <div className="titlebar-drag grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center h-9 bg-surface-900 border-b border-surface-800 flex-shrink-0 select-none">
      {/* App icon + title */}
      <div className="titlebar-no-drag flex min-w-0 items-center h-full justify-self-start">
        {!panelState.sidebarOpen && (
          <button
            id="titlebar-toggle-sidebar"
            onClick={toggleSidebar}
            className="flex items-center justify-center w-11 h-full shrink-0 text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors border-r border-surface-800 mr-2"
            title="Show Sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        <div className={cn("flex min-w-0 items-center gap-2 pr-4 h-full", panelState.sidebarOpen ? "pl-4" : "")}>
          <img src={LogoImage} alt="Write Your Thoughts Logo" className="w-3.5 h-3.5 flex-shrink-0 object-contain" />
          <span className="text-xs text-surface-400 font-medium truncate max-w-72">{title}</span>
        </div>
      </div>

      <div className="flex h-full items-center justify-center">
        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            className="titlebar-no-drag flex h-7 items-center gap-2 rounded-md border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper)/0.6)] px-3 text-xs text-surface-400 transition-colors hover:bg-surface-850 hover:text-surface-100"
            title="Search manuscript & commands (Ctrl+K)"
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Search or jump…</span>
            <kbd className="hidden sm:inline rounded border border-[hsl(var(--studio-edge))] px-1 py-0.5 text-[10px] text-surface-400">Ctrl+K</kbd>
          </button>
        )}
      </div>

      <div className="flex h-full items-center justify-end">
        <span
          role="status"
          title={isOnline ? 'Network connection detected' : 'Edits save locally and sync when you reconnect. Local AI works while its server is running.'}
          className={cn(
            'titlebar-no-drag mx-2 flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
            isOnline ? 'border-surface-700 text-surface-300' : 'border-warning-500/30 bg-warning-500/10 text-warning-400'
          )}
        >
          <NetworkIcon className={cn('h-3.5 w-3.5', isOnline && 'text-success-500')} aria-hidden="true" />
          {isOnline ? 'Online' : 'Offline'}
        </span>

        <CloudSyncStatus online={isOnline} />

        {/* Window controls */}
        <div className="titlebar-no-drag flex items-center h-full">
          <button
            id="titlebar-minimize"
            onClick={() => window.api.window.minimize()}
            className="flex items-center justify-center w-11 h-full text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-colors"
            title="Minimize"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            id="titlebar-maximize"
            onClick={() => window.api.window.maximize()}
            className="flex items-center justify-center w-11 h-full text-surface-500 hover:text-surface-200 hover:bg-surface-700 transition-colors"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            id="titlebar-close"
            onClick={() => window.api.window.close()}
            className="flex items-center justify-center w-11 h-full text-surface-500 hover:text-white hover:bg-danger-500 transition-colors"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
