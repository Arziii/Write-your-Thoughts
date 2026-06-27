import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen, Home, Settings, LogOut, ChevronLeft, PanelLeft
} from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { authService } from '../../services/authService'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import BookList from '../books/BookList'
import SharedBookList from '../books/SharedBookList'
import ChapterTree from '../chapters/ChapterTree'
import EntityTree from '../world/EntityTree'
import SidebarTimeline from '../world/SidebarTimeline'
import { Users, MapPin, StickyNote, Clock, BookMarked, Globe, Building2, Gavel, Brain, Network } from 'lucide-react'
import { DragDropContext, DropResult } from '@hello-pangea/dnd'

export default function Sidebar() {
  const { user, localUser } = useUserStore()
  const { 
    currentBook, setCurrentBook, toggleSidebar,
    characters, addCharacter, updateCharacter, removeCharacter,
    locations, addLocation, updateLocation, removeLocation,
    notes, addNote, updateNote, removeNote,
    timelineEvents, addTimelineEvent, updateTimelineEvent, removeTimelineEvent,
    codex, addCodex, updateCodex, removeCodex,
    wiki, addWiki, updateWiki, removeWiki,
    organizations, addOrganization, updateOrganization, removeOrganization,
    worldRules, addWorldRule, updateWorldRule, removeWorldRule,
    openTab, reorderChapters, reorderEntity
  } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()
  const { bookId } = useParams()
  
  const [sidebarTab, setSidebarTab] = useState<'explorer' | 'timeline'>('explorer')

  const handleSignOut = async () => {
    try {
      await authService.signOut()
      addToast('Signed out successfully', 'success')
    } catch {
      addToast('Failed to sign out', 'error')
    }
  }

  const handleGoHome = () => {
    setCurrentBook(null)
    navigate('/')
  }

  const handleBackToBooks = () => {
    setCurrentBook(null)
    navigate('/')
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    if (result.source.droppableId !== result.destination.droppableId) return

    const { source, destination } = result
    if (source.index === destination.index) return

    const type = source.droppableId
    if (type === 'chapters') {
      reorderChapters(source.index, destination.index)
    } else {
      const typeMap: Record<string, { stateKey: any, table: string }> = {
        character: { stateKey: 'characters', table: 'characters' },
        location: { stateKey: 'locations', table: 'locations' },
        organization: { stateKey: 'organizations', table: 'organizations' },
        world_rule: { stateKey: 'worldRules', table: 'world_rules' },
        codex: { stateKey: 'codex', table: 'codex' },
        wiki: { stateKey: 'wiki', table: 'wiki' },
        note: { stateKey: 'notes', table: 'notes' }
      }
      const mapping = typeMap[type]
      if (mapping) {
        reorderEntity(mapping.stateKey, mapping.table, source.index, destination.index)
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-900 border-r border-surface-800 w-60">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-800 h-9">
        {currentBook ? (
          <button
            onClick={handleBackToBooks}
            className="flex items-center gap-1.5 text-surface-400 hover:text-surface-200 text-xs font-medium transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            All Books
          </button>
        ) : (
          <span className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
            Workspace
          </span>
        )}
        <button
          id="sidebar-toggle"
          onClick={toggleSidebar}
          className="text-surface-600 hover:text-surface-300 transition-colors"
          title="Collapse sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Main navigation or book content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        {currentBook ? (
          <>
            {/* Sidebar Tabs */}
            <div className="flex items-center border-b border-surface-800 shrink-0">
              <button
                onClick={() => setSidebarTab('explorer')}
                className={cn(
                  "flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors",
                  sidebarTab === 'explorer' 
                    ? "text-accent-400 border-b-2 border-accent-500 bg-surface-800/30" 
                    : "text-surface-500 hover:text-surface-300 hover:bg-surface-800/10"
                )}
              >
                Explorer
              </button>
              <button
                onClick={() => setSidebarTab('timeline')}
                className={cn(
                  "flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors",
                  sidebarTab === 'timeline' 
                    ? "text-accent-400 border-b-2 border-accent-500 bg-surface-800/30" 
                    : "text-surface-500 hover:text-surface-300 hover:bg-surface-800/10"
                )}
              >
                Timeline
              </button>
            </div>

            <div className="flex-1 overflow-y-auto relative">
              {sidebarTab === 'explorer' ? (
                /* Book view: chapter tree + worldbuilding */
                <DragDropContext onDragEnd={handleDragEnd}>
                  <div className="space-y-4 py-2 pb-4">
                    <div className="px-3 pb-2 pt-1">
                    <button
                      onClick={() => openTab(currentBook.id, 'story_intelligence', 'Story Intelligence')}
                      className="w-full py-2 flex items-center gap-2 justify-center bg-accent-600/10 hover:bg-accent-600/20 text-accent-400 border border-accent-600/30 rounded-lg text-xs font-semibold transition-colors tracking-wider"
                    >
                      <Brain className="w-3.5 h-3.5" />
                      STORY INTELLIGENCE
                    </button>
                  </div>
                  <ChapterTree book={currentBook} />
                  
                  <div className="px-3 pb-2 border-b border-surface-800/50">
                    <button
                      onClick={() => openTab('relationships', 'relationship_manager', 'Relationships')}
                      className="w-full py-1.5 flex items-center gap-2 text-surface-400 hover:text-accent-400 hover:bg-surface-800/60 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors"
                    >
                      <Network className="w-3.5 h-3.5" />
                      Relationships
                    </button>
                  </div>
            
            <EntityTree
              title="Characters"
              type="character"
              icon={<Users className="w-3.5 h-3.5 text-blue-400" />}
              items={characters.map(c => ({ id: c.id, title: c.name }))}
              emptyMessage="No characters yet."
              onCreate={async (title) => {
                const char = await window.api.characters.create({ bookId: currentBook.id, name: title })
                addCharacter(char as any)
                addToast('Character created', 'success')
              }}
              onRename={async (id, title) => {
                const char = await window.api.characters.update({ id, name: title })
                updateCharacter(char as any)
                addToast('Character renamed', 'success')
              }}
              onDelete={async (id) => {
                await window.api.characters.delete(id)
                removeCharacter(id)
                addToast('Character deleted', 'info')
              }}
            />

            <EntityTree
              title="Locations"
              type="location"
              icon={<MapPin className="w-3.5 h-3.5 text-emerald-400" />}
              items={locations.map(l => ({ id: l.id, title: l.name }))}
              emptyMessage="No locations yet."
              onCreate={async (title) => {
                const loc = await window.api.locations.create({ bookId: currentBook.id, name: title })
                addLocation(loc as any)
                addToast('Location created', 'success')
              }}
              onRename={async (id, title) => {
                const loc = await window.api.locations.update({ id, name: title })
                updateLocation(loc as any)
                addToast('Location renamed', 'success')
              }}
              onDelete={async (id) => {
                await window.api.locations.delete(id)
                removeLocation(id)
                addToast('Location deleted', 'info')
              }}
            />

            <EntityTree
              title="Organizations"
              type="organization"
              icon={<Building2 className="w-3.5 h-3.5 text-amber-400" />}
              items={organizations.map(o => ({ id: o.id, title: o.title }))}
              emptyMessage="No organizations yet."
              singularTitle="Organization"
              onCreate={async (title) => {
                const item = await window.api.organizations.create({ bookId: currentBook.id, title })
                addOrganization(item as any)
                addToast('Organization created', 'success')
              }}
              onRename={async (id, title) => {
                const item = await window.api.organizations.update({ id, title })
                updateOrganization(item as any)
                addToast('Organization renamed', 'success')
              }}
              onDelete={async (id) => {
                await window.api.organizations.delete(id)
                removeOrganization(id)
                addToast('Organization deleted', 'info')
              }}
            />

            <EntityTree
              title="World Rules"
              type="world_rule"
              icon={<Gavel className="w-3.5 h-3.5 text-rose-400" />}
              items={worldRules.map(w => ({ id: w.id, title: w.title }))}
              emptyMessage="No rules yet."
              singularTitle="World Rule"
              onCreate={async (title) => {
                const item = await window.api.worldRules.create({ bookId: currentBook.id, title })
                addWorldRule(item as any)
                addToast('Rule created', 'success')
              }}
              onRename={async (id, title) => {
                const item = await window.api.worldRules.update({ id, title })
                updateWorldRule(item as any)
                addToast('Rule renamed', 'success')
              }}
              onDelete={async (id) => {
                await window.api.worldRules.delete(id)
                removeWorldRule(id)
                addToast('Rule deleted', 'info')
              }}
            />

            <EntityTree
              title="Codex"
              type="codex"
              icon={<BookMarked className="w-3.5 h-3.5 text-purple-400" />}
              items={codex.map(c => ({ id: c.id, title: c.title }))}
              emptyMessage="No codex entries yet."
              singularTitle="Codex Entry"
              onCreate={async (title) => {
                const item = await window.api.codex.create({ bookId: currentBook.id, title })
                addCodex(item as any)
                addToast('Codex entry created', 'success')
              }}
              onRename={async (id, title) => {
                const item = await window.api.codex.update({ id, title })
                updateCodex(item as any)
                addToast('Codex entry renamed', 'success')
              }}
              onDelete={async (id) => {
                await window.api.codex.delete(id)
                removeCodex(id)
                addToast('Codex entry deleted', 'info')
              }}
            />

            <EntityTree
              title="Wiki"
              type="wiki"
              icon={<Globe className="w-3.5 h-3.5 text-cyan-400" />}
              items={wiki.map(w => ({ id: w.id, title: w.title }))}
              emptyMessage="No wiki articles yet."
              singularTitle="Wiki Article"
              onCreate={async (title) => {
                const item = await window.api.wiki.create({ bookId: currentBook.id, title })
                addWiki(item as any)
                addToast('Wiki article created', 'success')
              }}
              onRename={async (id, title) => {
                const item = await window.api.wiki.update({ id, title })
                updateWiki(item as any)
                addToast('Wiki article renamed', 'success')
              }}
              onDelete={async (id) => {
                await window.api.wiki.delete(id)
                removeWiki(id)
                addToast('Wiki article deleted', 'info')
              }}
            />

            <EntityTree
              title="Notes"
              type="note"
              icon={<StickyNote className="w-3.5 h-3.5 text-yellow-400" />}
              items={notes.map(n => ({ id: n.id, title: n.title }))}
              emptyMessage="No notes yet."
              onCreate={async (title) => {
                const note = await window.api.notes.create({ bookId: currentBook.id, title })
                addNote(note as any)
                addToast('Note created', 'success')
              }}
              onRename={async (id, title) => {
                const note = await window.api.notes.update({ id, title })
                updateNote(note as any)
                addToast('Note renamed', 'success')
              }}
              onDelete={async (id) => {
                await window.api.notes.delete(id)
                removeNote(id)
                addToast('Note deleted', 'info')
              }}
            />
          </div>
        </DragDropContext>
              ) : (
                <SidebarTimeline />
              )}
            </div>
          </>
        ) : (
          /* Global view: book list + nav */
          <div className="space-y-0.5">
            <button
              id="nav-dashboard"
              onClick={handleGoHome}
              className={cn(
                'flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-md mx-1 transition-colors',
                !bookId
                  ? 'bg-surface-800 text-surface-100'
                  : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60'
              )}
            >
              <Home className="w-4 h-4 flex-shrink-0" />
              Dashboard
            </button>

            <div className="px-3 pt-4 pb-1">
              <span className="text-[10px] uppercase tracking-widest text-surface-600 font-semibold">
                Books
              </span>
            </div>

            <BookList />
            <SharedBookList />
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-surface-800 py-2 space-y-0.5">
        <button
          id="nav-settings"
          onClick={() => navigate('/settings')}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 rounded-md mx-1 transition-colors"
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          Settings
        </button>

        <div className="px-3 py-1.5 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-accent-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {localUser?.avatar_url ? (
              <img src={localUser.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-[10px] font-bold uppercase">
                {user?.email?.[0] ?? 'U'}
              </span>
            )}
          </div>
          <span className="text-xs text-surface-400 truncate flex-1">
            {user?.user_metadata?.display_name || user?.email}
          </span>
          <button
            id="nav-signout"
            onClick={handleSignOut}
            className="text-surface-600 hover:text-danger-400 transition-colors flex-shrink-0"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
