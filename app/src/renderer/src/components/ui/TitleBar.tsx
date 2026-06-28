import { Minus, Square, X, PanelLeft } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn } from '../../utils'
import LogoImage from '../../assets/Logo.ico'

export default function TitleBar() {
  const { currentBook, activeChapter, panelState, toggleSidebar } = useWorkspaceStore()
  const location = useLocation()
  const isEditorRoute = location.pathname.startsWith('/book')

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
