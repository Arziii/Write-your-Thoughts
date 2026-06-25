import { useNavigate } from 'react-router-dom'
import { X, Circle, FileText, Users, MapPin, StickyNote, Clock, BookMarked, Globe } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn } from '../../utils'
import type { TabType } from '../../types'

const TypeIcon = ({ type, className }: { type: TabType; className?: string }) => {
  switch (type) {
    case 'chapter': return <FileText className={className} />
    case 'character': return <Users className={className} />
    case 'location': return <MapPin className={className} />
    case 'note': return <StickyNote className={className} />
    case 'timeline': return <Clock className={className} />
    case 'codex': return <BookMarked className={className} />
    case 'wiki': return <Globe className={className} />
    default: return <FileText className={className} />
  }
}

export default function EditorTabs() {
  const { tabs, activeTabId, closeTab, openTab, currentBook } = useWorkspaceStore()
  const navigate = useNavigate()

  if (tabs.length === 0) return null

  const handleTabClick = (tab: typeof tabs[number]) => {
    openTab(tab.id, tab.type, tab.title)
    navigate(`/book/${currentBook?.id}`)
  }

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    closeTab(tabId)
    navigate(`/book/${currentBook?.id}`)
  }

  return (
    <div className="flex items-end bg-surface-900 border-b border-surface-800 overflow-x-auto flex-shrink-0">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`tab-${tab.id}`}
          onClick={() => handleTabClick(tab)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 min-w-28 max-w-44 cursor-pointer border-r border-surface-800 flex-shrink-0 group transition-colors',
            activeTabId === tab.id
              ? 'bg-surface-950 border-t-2 border-t-accent-500 text-surface-100'
              : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/60'
          )}
        >
          {tab.isDirty ? (
            <Circle className="w-1.5 h-1.5 fill-accent-400 text-accent-400 flex-shrink-0" />
          ) : (
            <TypeIcon type={tab.type} className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
          )}
          <span className="truncate text-xs flex-1">{tab.title}</span>
          <button
            onClick={(e) => handleClose(e, tab.id)}
            className="opacity-0 group-hover:opacity-100 hover:text-surface-100 transition-all flex-shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
