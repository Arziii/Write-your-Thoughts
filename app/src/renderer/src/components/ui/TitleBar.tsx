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
    <div className="titlebar-drag flex items-center h-9 bg-surface-900 border-b border-surface-800 flex-shrink-0 select-none">
      {/* App icon + title */}
      <div className="titlebar-no-drag flex items-center h-full">
        {!panelState.sidebarOpen && (
          <button
            id="titlebar-toggle-sidebar"
            onClick={toggleSidebar}
            className="flex items-center justify-center w-11 h-full text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors border-r border-surface-800 mr-2"
            title="Show Sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        <div className={cn("flex items-center gap-2 pr-4 h-full", panelState.sidebarOpen ? "pl-4" : "")}>
          <img src={LogoImage} alt="Write Your Thoughts Logo" className="w-3.5 h-3.5 flex-shrink-0 object-contain" />
          <span className="text-xs text-surface-400 font-medium truncate max-w-72">{title}</span>
        </div>
      </div>

      <div className="flex-1" />

      <span
        role="status"
        title={isOnline ? 'Network connection detected' : 'No network connection. Edits save locally and sync when you reconnect.'}
        className={cn(
          'titlebar-no-drag mx-2 flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
          isOnline ? 'border-surface-700 text-surface-300' : 'border-warning-500/30 bg-warning-500/10 text-warning-400'
        )}
      >
        <NetworkIcon className={cn('h-3.5 w-3.5', isOnline && 'text-success-500')} aria-hidden="true" />
        {isOnline ? 'Online' : 'Offline'}
      </span>

      <CloudSyncStatus online={isOnline} />

      {onSearch && (
        <button
          type="button"
          onClick={onSearch}
          className="titlebar-no-drag flex h-full items-center gap-2 px-3 text-xs text-surface-400 hover:bg-surface-800 hover:text-surface-100"
          title="Search manuscript (Ctrl+K)"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Search manuscript</span>
        </button>
      )}

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
  )
}
