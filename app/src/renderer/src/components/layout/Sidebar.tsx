import { useState } from 'react'
import { useOpenBookTab } from '../../hooks/useOpenBookTab'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  Home, MessageSquare, Settings, LogOut, ChevronLeft, PanelLeft,
  Users, Map as MapIcon, MapPin, StickyNote, Clock, BookMarked,
  Globe, Building2, Gavel, Brain, Network, Search, X, Download, Upload, Trash2
} from 'lucide-react'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { authService } from '../../services/authService'
import { syncNow } from '../../services/syncService'
import { flushEditorSaves } from '../../hooks/useEditorSave'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import Modal from '../ui/Modal'
import { Button } from '../ui/primitives'
import ExportModal from '../export/ExportModal'
import ImportModal from '../import/ImportModal'
import ClearStoryContentModal from '../import/ClearStoryContentModal'
import BookList from '../books/BookList'
import SharedBookList from '../books/SharedBookList'
import ChapterTree from '../chapters/ChapterTree'
import EntityTree from '../world/EntityTree'
import SidebarTimeline from '../world/SidebarTimeline'
import { DragDropContext, DropResult } from '@hello-pangea/dnd'

export default function Sidebar() {
  const { user, localUser } = useUserStore()
  const {
    currentBook, toggleSidebar,
    characters, addCharacter, updateCharacter, removeCharacter,
    locations, addLocation, updateLocation, removeLocation,
    notes, addNote, updateNote, removeNote,
    codex, addCodex, updateCodex, removeCodex,
    wiki, addWiki, updateWiki, removeWiki,
    organizations, addOrganization, updateOrganization, removeOrganization,
    worldRules, addWorldRule, updateWorldRule, removeWorldRule,
    reorderChapters, reorderEntity
  } = useWorkspaceStore()
  const openBookTab = useOpenBookTab()
  const { addToast } = useToastStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { bookId } = useParams()

  const [sidebarTab, setSidebarTab] = useState<'explorer' | 'timeline'>('explorer')
  const [filterQuery, setFilterQuery] = useState('')
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isClearContentOpen, setIsClearContentOpen] = useState(false)

  const confirmSignOut = async () => {
    setIsLoggingOut(true)
    try {
      if (!await flushEditorSaves()) {
        setIsLoggingOut(false)
        return
      }
      await syncNow()
      await authService.signOut()
      window.location.reload()
    } catch {
      addToast('Failed to sign out', 'error')
      setIsLoggingOut(false)
      setShowLogoutConfirm(false)
    }
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
      const typeMap: Record<string, { stateKey: any; table: string }> = {
        character: { stateKey: 'characters', table: 'characters' },
        location: { stateKey: 'locations', table: 'locations' },
        organization: { stateKey: 'organizations', table: 'organizations' },
        world_rule: { stateKey: 'worldRules', table: 'world_rules' },
        codex: { stateKey: 'codex', table: 'codex' },
        wiki: { stateKey: 'wiki', table: 'wiki' },
        note: { stateKey: 'notes', table: 'notes' }
      }
      const mapping = typeMap[type]
      if (mapping) reorderEntity(mapping.stateKey, mapping.table, source.index, destination.index)
    }
  }

  const trimmedFilter = filterQuery.trim().toLowerCase()

  return (
    <div
      className="flex h-full w-full flex-col border-r border-[hsl(var(--studio-edge))] bg-surface-900"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[hsl(var(--studio-edge))] bg-surface-900 px-2.5">
        {currentBook ? (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-xs font-semibold text-surface-400 transition-colors hover:text-[hsl(var(--brand-green))]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All Books
          </button>
        ) : (
          <span className="px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-surface-500">
            Workspace
          </span>
        )}
        <div className="flex items-center gap-1">
          {currentBook && (
            <>
              <button
                type="button"
                onClick={() => setIsImportOpen(true)}
                title="Import from Campfire / Files"
                aria-label="Import from Campfire / Files"
                className="rounded p-1 text-surface-500 transition-colors hover:bg-surface-850 hover:text-surface-200"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExportOpen(true)}
                title="Export Book"
                aria-label="Export Book"
                className="rounded p-1 text-surface-500 transition-colors hover:bg-surface-850 hover:text-surface-200"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsClearContentOpen(true)}
                title="Clear Story Content (keeps Maps)"
                aria-label="Clear Story Content"
                className="rounded p-1 text-surface-500 transition-colors hover:bg-danger-500/10 hover:text-danger-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            id="sidebar-toggle"
            type="button"
            onClick={toggleSidebar}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
            className="rounded p-1 text-surface-500 transition-colors hover:bg-surface-850 hover:text-surface-200"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {currentBook ? (
          <>
            {/* Explorer / Book Chronology tabs */}
            <div className="flex shrink-0 items-center border-b border-[hsl(var(--studio-edge))]">
              <button
                type="button"
                onClick={() => setSidebarTab('explorer')}
                className={cn(
                  'flex-1 border-b-2 py-2 text-[10px] font-bold uppercase tracking-[0.09em] transition-colors',
                  sidebarTab === 'explorer'
                    ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                    : 'border-transparent text-surface-400 hover:text-surface-200'
                )}
              >
                Explorer
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('timeline')}
                title="Book Chronology — story days & chapter dates"
                className={cn(
                  'flex-1 border-b-2 py-2 text-[10px] font-bold uppercase tracking-[0.09em] transition-colors',
                  sidebarTab === 'timeline'
                    ? 'border-[hsl(var(--brand-green))] bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                    : 'border-transparent text-surface-400 hover:text-surface-200'
                )}
              >
                Chronology
              </button>
            </div>

            <div className="relative flex-1 overflow-y-auto">
              {sidebarTab === 'explorer' ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <div className="pb-4">
                    {/* Quick filter */}
                    <div className="px-2.5 pt-2.5">
                      <div className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] px-2 py-1 focus-within:border-[hsl(var(--brand-green))]">
                        <Search className="h-3 w-3 shrink-0 text-surface-500" aria-hidden="true" />
                        <input
                          type="text"
                          value={filterQuery}
                          onChange={e => setFilterQuery(e.target.value)}
                          placeholder="Filter chapters & lore…"
                          aria-label="Filter chapters and worldbuilding"
                          className="min-w-0 flex-1 bg-transparent text-xs text-surface-100 placeholder:text-surface-500 focus:outline-none"
                        />
                        {filterQuery && (
                          <button
                            type="button"
                            onClick={() => setFilterQuery('')}
                            aria-label="Clear filter"
                            className="rounded p-0.5 text-surface-500 hover:text-surface-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Story Intelligence */}
                    {(!trimmedFilter || 'story intelligence'.includes(trimmedFilter)) && (
                      <div className="px-2.5 pt-2.5 pb-1">
                        <button
                          type="button"
                          onClick={() => openBookTab(currentBook.id, 'story_intelligence', 'Story Intelligence')}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--brand-green-bg))] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.07em] text-[hsl(var(--brand-green))] transition-opacity hover:opacity-90"
                        >
                          <Brain className="h-3.5 w-3.5" />
                          Story Intelligence
                        </button>
                      </div>
                    )}

                    <ChapterTree book={currentBook} filterQuery={filterQuery} />

                    <EntityTree
                      title="Characters" type="character" filterQuery={filterQuery}
                      icon={<Users className="w-3.5 h-3.5 text-blue-400" />}
                      items={characters.map(c => ({ id: c.id, title: c.name }))}
                      emptyMessage="No characters yet."
                      onCreate={async (title) => { const char = await window.api.characters.create({ bookId: currentBook.id, name: title }); addCharacter(char as any); addToast('Character created', 'success') }}
                      onRename={async (id, title) => { const char = await window.api.characters.update({ id, name: title }); updateCharacter(char as any); addToast('Character renamed', 'success') }}
                      onDelete={async (id) => { await window.api.characters.delete(id); removeCharacter(id); addToast('Character deleted', 'info') }}
                    />

                    <EntityTree
                      title="Locations" type="location" filterQuery={filterQuery}
                      icon={<MapPin className="w-3.5 h-3.5 text-emerald-400" />}
                      items={locations.map(l => ({ id: l.id, title: l.name }))}
                      emptyMessage="No locations yet."
                      onCreate={async (title) => { const loc = await window.api.locations.create({ bookId: currentBook.id, name: title }); addLocation(loc as any); addToast('Location created', 'success') }}
                      onRename={async (id, title) => { const loc = await window.api.locations.update({ id, name: title }); updateLocation(loc as any); addToast('Location renamed', 'success') }}
                      onDelete={async (id) => { await window.api.locations.delete(id); removeLocation(id); addToast('Location deleted', 'info') }}
                    />

                    {(!trimmedFilter || 'maps'.includes(trimmedFilter) || 'atlas'.includes(trimmedFilter)) && (
                      <div className="px-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => openBookTab(`maps-${currentBook.id}`, 'maps', 'Maps')}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--brand-green))] transition-colors hover:bg-surface-850"
                        >
                          <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          Maps
                        </button>
                      </div>
                    )}

                    {(!trimmedFilter || 'relationships'.includes(trimmedFilter)) && (
                      <div className="mt-2 px-2.5">
                        <button
                          type="button"
                          onClick={() => openBookTab('relationships', 'relationship_manager', 'Relationships')}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--brand-green))] transition-colors hover:bg-surface-850"
                        >
                          <Network className="h-3.5 w-3.5" />
                          Relationships
                        </button>
                      </div>
                    )}

                    {(!trimmedFilter || 'world history'.includes(trimmedFilter) || 'timeline record'.includes(trimmedFilter)) && (
                      <div className="mt-2 px-2.5">
                        <button
                          type="button"
                          title="World History — verse timeline record"
                          onClick={() => openBookTab('verse_timeline', 'verse_timeline', 'World History')}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--brand-green))] transition-colors hover:bg-surface-850"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          World History
                        </button>
                      </div>
                    )}

                    <EntityTree
                      title="Organizations" type="organization" filterQuery={filterQuery}
                      icon={<Building2 className="w-3.5 h-3.5 text-amber-400" />}
                      items={organizations.map(o => ({ id: o.id, title: o.title }))}
                      emptyMessage="No organizations yet." singularTitle="Organization"
                      onCreate={async (title) => { const item = await window.api.organizations.create({ bookId: currentBook.id, title }); addOrganization(item as any); addToast('Organization created', 'success') }}
                      onRename={async (id, title) => { const item = await window.api.organizations.update({ id, title }); updateOrganization(item as any); addToast('Organization renamed', 'success') }}
                      onDelete={async (id) => { await window.api.organizations.delete(id); removeOrganization(id); addToast('Organization deleted', 'info') }}
                    />

                    <EntityTree
                      title="World Rules" type="world_rule" filterQuery={filterQuery}
                      icon={<Gavel className="w-3.5 h-3.5 text-rose-400" />}
                      items={worldRules.map(w => ({ id: w.id, title: w.title }))}
                      emptyMessage="No rules yet." singularTitle="World Rule"
                      onCreate={async (title) => { const item = await window.api.worldRules.create({ bookId: currentBook.id, title }); addWorldRule(item as any); addToast('Rule created', 'success') }}
                      onRename={async (id, title) => { const item = await window.api.worldRules.update({ id, title }); updateWorldRule(item as any); addToast('Rule renamed', 'success') }}
                      onDelete={async (id) => { await window.api.worldRules.delete(id); removeWorldRule(id); addToast('Rule deleted', 'info') }}
                    />

                    <EntityTree
                      title="Codex" type="codex" filterQuery={filterQuery}
                      icon={<BookMarked className="w-3.5 h-3.5 text-purple-400" />}
                      items={codex.map(c => ({ id: c.id, title: c.title }))}
                      emptyMessage="No codex entries yet." singularTitle="Codex Entry"
                      onCreate={async (title) => { const item = await window.api.codex.create({ bookId: currentBook.id, title }); addCodex(item as any); addToast('Codex entry created', 'success') }}
                      onRename={async (id, title) => { const item = await window.api.codex.update({ id, title }); updateCodex(item as any); addToast('Codex entry renamed', 'success') }}
                      onDelete={async (id) => { await window.api.codex.delete(id); removeCodex(id); addToast('Codex entry deleted', 'info') }}
                    />

                    <EntityTree
                      title="Wiki" type="wiki" filterQuery={filterQuery}
                      icon={<Globe className="w-3.5 h-3.5 text-cyan-400" />}
                      items={wiki.map(w => ({ id: w.id, title: w.title }))}
                      emptyMessage="No wiki articles yet." singularTitle="Wiki Article"
                      onCreate={async (title) => { const item = await window.api.wiki.create({ bookId: currentBook.id, title }); addWiki(item as any); addToast('Wiki article created', 'success') }}
                      onRename={async (id, title) => { const item = await window.api.wiki.update({ id, title }); updateWiki(item as any); addToast('Wiki article renamed', 'success') }}
                      onDelete={async (id) => { await window.api.wiki.delete(id); removeWiki(id); addToast('Wiki article deleted', 'info') }}
                    />

                    <EntityTree
                      title="Notes" type="note" filterQuery={filterQuery}
                      icon={<StickyNote className="w-3.5 h-3.5 text-yellow-400" />}
                      items={notes.map(n => ({ id: n.id, title: n.title }))}
                      emptyMessage="No notes yet."
                      onCreate={async (title) => { const note = await window.api.notes.create({ bookId: currentBook.id, title }); addNote(note as any); addToast('Note created', 'success') }}
                      onRename={async (id, title) => { const note = await window.api.notes.update({ id, title }); updateNote(note as any); addToast('Note renamed', 'success') }}
                      onDelete={async (id) => { await window.api.notes.delete(id); removeNote(id); addToast('Note deleted', 'info') }}
                    />
                  </div>
                </DragDropContext>
              ) : (
                <SidebarTimeline />
              )}
            </div>
          </>
        ) : (
          /* Global view */
          <div className="pt-1">
            <button
              id="nav-dashboard"
              type="button"
              onClick={() => navigate('/')}
              className={cn(
                'mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-semibold transition-colors',
                !bookId && location.pathname === '/'
                  ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                  : 'text-surface-400 hover:bg-surface-850 hover:text-surface-200'
              )}
            >
              <Home className="h-4 w-4 shrink-0" />
              Dashboard
            </button>

            <div className="px-3 pt-3.5 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-surface-500">
                Books
              </span>
            </div>

            <BookList />
            <SharedBookList />
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-[hsl(var(--studio-edge))] py-1.5">
        <button
          id="nav-ai-chat"
          type="button"
          aria-current={location.pathname === '/ai-chat' ? 'page' : undefined}
          onClick={() => navigate('/ai-chat')}
          className={cn(
            'mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-colors',
            location.pathname === '/ai-chat'
              ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))] font-semibold'
              : 'text-surface-400 hover:bg-surface-850 hover:text-surface-200'
          )}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          AI Chat
        </button>
        <button
          id="nav-settings"
          type="button"
          aria-current={location.pathname === '/settings' ? 'page' : undefined}
          onClick={() => navigate('/settings')}
          className={cn(
            'mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-colors',
            location.pathname === '/settings'
              ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))] font-semibold'
              : 'text-surface-400 hover:bg-surface-850 hover:text-surface-200'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </button>

        {/* User row */}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[hsl(var(--studio-edge))] bg-[hsl(var(--brand-green))]">
            {localUser?.avatar_url ? (
              <img src={localUser.avatar_url} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold uppercase text-white dark:text-surface-950">
                {user?.email?.[0] ?? 'U'}
              </span>
            )}
          </div>
          <span className="min-w-0 flex-1 truncate text-xs text-surface-400">
            {user?.user_metadata?.display_name || user?.email}
          </span>
          <button
            id="nav-signout"
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            title="Sign out"
            aria-label="Sign out"
            className="shrink-0 rounded p-1 text-surface-500 transition-colors hover:text-danger-500"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <Modal
        isOpen={showLogoutConfirm}
        onClose={() => !isLoggingOut && setShowLogoutConfirm(false)}
        title="Confirm Logout"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-surface-300">
            Are you sure you want to log out? We'll make sure all your recent changes are safely synced to the cloud first.
          </p>
          <div className="mt-2 flex justify-end gap-3">
            <Button variant="secondary" size="md" onClick={() => setShowLogoutConfirm(false)} disabled={isLoggingOut}>
              Cancel
            </Button>
            <Button variant="danger" size="md" onClick={confirmSignOut} disabled={isLoggingOut}>
              {isLoggingOut ? 'Syncing…' : 'Log Out'}
            </Button>
          </div>
        </div>
      </Modal>

      {currentBook && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          book={currentBook}
        />
      )}

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        currentBook={currentBook}
        onImportComplete={(res) => {
          if (res.createdBook) {
            navigate(`/book/${res.createdBook.id}`)
          }
        }}
      />

      <ClearStoryContentModal
        isOpen={isClearContentOpen}
        onClose={() => setIsClearContentOpen(false)}
        book={currentBook}
      />
    </div>
  )
}
