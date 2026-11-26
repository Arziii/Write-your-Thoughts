import { useEffect, useRef } from 'react'
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
  const stripRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const strip = stripRef.current
    const tab = activeTabRef.current
    if (!strip || !tab) return
    const viewport = strip.getBoundingClientRect()
    const bounds = tab.getBoundingClientRect()
    if (bounds.left < viewport.left) strip.scrollLeft += bounds.left - viewport.left
    else if (bounds.right > viewport.right) strip.scrollLeft += bounds.right - viewport.right
  }, [activeTabId, tabs.length])

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
    <div ref={stripRef} role="group" className="studio-tab-strip flex min-w-0 shrink-0 items-center gap-1 overflow-x-auto px-2 py-1" aria-label="Open workspace tabs">
      {tabs.map(tab => {
        const active = tab.id === activeTabId
        return (
          <div
            key={tab.id}
            id={`tab-${tab.id}`}
            ref={active ? activeTabRef : undefined}
            data-active={active}
            className="studio-tab group flex h-8 min-w-[7.5rem] max-w-[15rem] flex-1 items-center rounded-lg border border-transparent text-surface-400 transition-colors"
          >
            <button type="button" onClick={() => handleTabClick(tab)} title={tab.title}
              aria-current={active ? 'page' : undefined}
              className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pl-2.5 text-left text-xs focus-visible:outline focus-visible:-outline-offset-2 focus-visible:outline-current">
              <span className="relative flex shrink-0 items-center text-[hsl(var(--brand-green))]">
                <TypeIcon type={tab.type} className="h-3.5 w-3.5" />
                {tab.isDirty && <Circle aria-label="Unsaved changes" className="absolute -right-1 -top-0.5 h-1.5 w-1.5 fill-amber-600 text-amber-600" />}
              </span>
              <span className="truncate pr-1">{tab.title}</span>
            </button>
            <button type="button" onClick={event => handleClose(event, tab.id)} aria-label={`Close ${tab.title}`}
              className={cn('mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-surface-400 hover:bg-surface-800 hover:text-surface-100 focus-visible:opacity-100',
                !active && 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')}>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
