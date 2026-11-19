import { useNavigate } from 'react-router-dom'
import { X, Circle, FileText, Users, Map, MapPin, StickyNote, Clock, BookMarked, Globe } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn } from '../../utils'
import type { TabType } from '../../types'

const TypeIcon = ({ type, className }: { type: TabType; className?: string }) => {
  switch (type) {
    case 'chapter': return <FileText className={className} />
    case 'character': return <Users className={className} />
    case 'location': return <MapPin className={className} />
    case 'maps': return <Map className={className} />
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
    <div className="studio-tab-strip flex shrink-0 items-center gap-1 overflow-x-auto px-2 py-1.5" aria-label="Open workspace tabs">
      {tabs.map(tab => {
        const active = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            id={`tab-${tab.id}`}
            data-active={active}
            className={cn(
              'studio-tab group flex min-w-28 max-w-52 shrink-0 items-center rounded-md border border-transparent text-surface-400',
              active ? 'font-semibold' : 'hover:bg-surface-950/50 hover:text-surface-100'
            )}
          >
            <button type="button" onClick={() => handleTabClick(tab)} title={tab.title}
              aria-current={active ? 'page' : undefined}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pl-2.5 pr-1.5 text-left text-xs focus-visible:outline focus-visible:outline-current">
              {tab.isDirty ? (
                <Circle aria-label="Unsaved changes" className="h-1.5 w-1.5 shrink-0 fill-amber-600 text-amber-600" />
              ) : (
                <TypeIcon type={tab.type} className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-[hsl(var(--brand-green))]' : 'opacity-75')} />
              )}
              <span className="truncate">{tab.title}</span>
            </button>
            <button type="button" onClick={event => handleClose(event, tab.id)} aria-label={`Close ${tab.title}`}
              className={cn('mr-1 shrink-0 rounded p-1 text-surface-500 hover:bg-surface-800 hover:text-surface-100 focus-visible:opacity-100',
                !active && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')}>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
