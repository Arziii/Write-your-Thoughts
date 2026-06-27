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
    <div 
      className="flex items-end overflow-x-auto flex-shrink-0"
      style={{
        background: '#f0ece4', // parchment background
        borderBottom: '1px solid #d0c9bc',
        fontFamily: "'DM Sans', sans-serif"
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`tab-${tab.id}`}
          onClick={() => handleTabClick(tab)}
          className="flex items-center gap-2 px-3 py-2 min-w-28 max-w-44 cursor-pointer flex-shrink-0 group transition-all"
          style={{
            background: activeTabId === tab.id ? '#fffefb' : 'transparent',
            borderRight: '1px solid #d0c9bc',
            borderTop: activeTabId === tab.id ? '2px solid #2d5a27' : '2px solid transparent',
            color: activeTabId === tab.id ? '#1a2e18' : '#7a8c77',
            borderTopLeftRadius: activeTabId === tab.id ? 6 : 0,
            borderTopRightRadius: activeTabId === tab.id ? 6 : 0,
            fontWeight: activeTabId === tab.id ? 600 : 500,
          }}
          onMouseEnter={e => {
            if (activeTabId !== tab.id) {
              (e.currentTarget as HTMLElement).style.background = '#e8e2d8';
              (e.currentTarget as HTMLElement).style.color = '#3d5c3a';
            }
          }}
          onMouseLeave={e => {
            if (activeTabId !== tab.id) {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#7a8c77';
            }
          }}
        >
          {tab.isDirty ? (
            <Circle style={{ width: 6, height: 6, color: '#d97706', fill: '#d97706' }} className="flex-shrink-0" />
          ) : (
            <TypeIcon type={tab.type} className="w-3.5 h-3.5 opacity-70 flex-shrink-0" />
          )}
          <span className="truncate text-xs flex-1">{tab.title}</span>
          <button
            onClick={(e) => handleClose(e, tab.id)}
            className="opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
            style={{ color: '#a0b09e' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ef4444'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#a0b09e'}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
