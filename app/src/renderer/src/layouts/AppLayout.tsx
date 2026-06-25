import { Outlet } from 'react-router-dom'
import TitleBar from '../components/ui/TitleBar'
import { useWorkspaceStore } from '../stores/workspaceStore'
import Sidebar from '../components/layout/Sidebar'
import AIPanel from '../components/ai/AIPanel'
import SearchModal from '../components/ui/SearchModal'
import { cn } from '../utils'

export default function AppLayout() {
  const { panelState, focusMode } = useWorkspaceStore()

  return (
    <div className="flex flex-col h-full bg-surface-950 overflow-hidden">
      {/* Custom title bar */}
      <TitleBar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className={cn(
            'panel-transition overflow-hidden flex-shrink-0',
            panelState.sidebarOpen && !focusMode ? 'w-60' : 'w-0 opacity-0'
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
            'panel-transition overflow-hidden flex-shrink-0 border-l border-surface-800',
            panelState.aiPanelOpen && !focusMode ? 'w-80' : 'w-0 opacity-0'
          )}
        >
          <AIPanel />
        </div>
      </div>

      <SearchModal />
    </div>
  )
}
