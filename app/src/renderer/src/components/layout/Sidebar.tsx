import { useState } from 'react'
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

// ── Forest Literary Palette ──────────────────────────────────────────
const F = {
  bg: 'hsl(var(--surface-900))',
  bgHover: 'hsl(var(--surface-850))',
  active: 'hsl(var(--surface-800))',
  border: 'hsl(var(--surface-800))',
  green: 'hsl(var(--brand-green))',
  greenLight: 'hsl(var(--brand-green-bg))',
  text: 'hsl(var(--surface-50))',
  textMid: 'hsl(var(--surface-300))',
  textSoft: 'hsl(var(--surface-500))',
  textFaint: 'hsl(var(--surface-600))',
}

export default function Sidebar() {
  const { user, localUser } = useUserStore()
  const {
    currentBook, setCurrentBook, toggleSidebar,
    characters, addCharacter, updateCharacter, removeCharacter,
    locations, addLocation, updateLocation, removeLocation,
    notes, addNote, updateNote, removeNote,
    timelineEvents, setTimelineEvents, addTimelineEvent, updateTimelineEvent, removeTimelineEvent,
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

  const handleGoHome = () => { setCurrentBook(null); navigate('/') }
  const handleBackToBooks = () => { setCurrentBook(null); navigate('/') }

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
      if (mapping) reorderEntity(mapping.stateKey, mapping.table, source.index, destination.index)
    }
  }

  return (
    <div
      className="flex flex-col h-full w-60"
      style={{
        background: F.bg,
        borderRight: `1px solid ${F.border}`,
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px', borderBottom: `1px solid ${F.border}`,
          height: 38, background: F.bg,
        }}
      >
        {currentBook ? (
          <button
            onClick={handleBackToBooks}
            style={{ display: 'flex', alignItems: 'center', gap: 5, color: F.textSoft, fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = F.green}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = F.textSoft}
          >
            <ChevronLeft style={{ width: 14, height: 14 }} />
            All Books
          </button>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, color: F.textFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Workspace
          </span>
        )}
        <button
          id="sidebar-toggle"
          onClick={toggleSidebar}
          style={{ color: F.textFaint, background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s', padding: 2 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = F.textMid}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = F.textFaint}
          title="Collapse sidebar"
        >
          <PanelLeft style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* ── Main content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
        {currentBook ? (
          <>
            {/* Explorer / Timeline tabs */}
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${F.border}`, flexShrink: 0 }}>
              <button
                onClick={() => setSidebarTab('explorer')}
                style={{
                  flex: 1, padding: '9px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em',
                  background: sidebarTab === 'explorer' ? F.greenLight : 'transparent',
                  color: sidebarTab === 'explorer' ? F.green : F.textSoft,
                  borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: sidebarTab === 'explorer' ? `2px solid ${F.green}` : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                Explorer
              </button>
              <button
                onClick={() => setSidebarTab('timeline')}
                style={{
                  flex: 1, padding: '9px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em',
                  background: sidebarTab === 'timeline' ? F.greenLight : 'transparent',
                  color: sidebarTab === 'timeline' ? F.green : F.textSoft,
                  borderTop: 'none', borderRight: 'none', borderLeft: 'none', borderBottom: sidebarTab === 'timeline' ? `2px solid ${F.green}` : '2px solid transparent',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                Timeline
              </button>
            </div>

            <div className="flex-1 overflow-y-auto relative">
              {sidebarTab === 'explorer' ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <div style={{ paddingBottom: 16 }}>

                    {/* Story Intelligence */}
                    <div style={{ padding: '10px 10px 8px' }}>
                      <button
                        onClick={() => openTab(currentBook.id, 'story_intelligence', 'Story Intelligence')}
                        style={{
                          width: '100%', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
                          justifyContent: 'center', borderRadius: 10, fontSize: 11, fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer',
                          background: F.greenLight, color: F.green, border: `1px solid ${F.border}`,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#d4e9d0'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = F.greenLight}
                      >
                        <Brain style={{ width: 14, height: 14 }} />
                        Story Intelligence
                      </button>
                    </div>

                    {/* Chapter Tree inherits its own styles */}
                    <ChapterTree book={currentBook} />



                    {/* Entity sections */}
                    <EntityTree
                      title="Characters" type="character"
                      icon={<Users className="w-3.5 h-3.5 text-blue-400" />}
                      items={characters.map(c => ({ id: c.id, title: c.name }))}
                      emptyMessage="No characters yet."
                      onCreate={async (title) => { const char = await window.api.characters.create({ bookId: currentBook.id, name: title }); addCharacter(char as any); addToast('Character created', 'success') }}
                      onRename={async (id, title) => { const char = await window.api.characters.update({ id, name: title }); updateCharacter(char as any); addToast('Character renamed', 'success') }}
                      onDelete={async (id) => { await window.api.characters.delete(id); removeCharacter(id); addToast('Character deleted', 'info') }}
                    />

                    <EntityTree
                      title="Locations" type="location"
                      icon={<MapPin className="w-3.5 h-3.5 text-emerald-400" />}
                      items={locations.map(l => ({ id: l.id, title: l.name }))}
                      emptyMessage="No locations yet."
                      onCreate={async (title) => { const loc = await window.api.locations.create({ bookId: currentBook.id, name: title }); addLocation(loc as any); addToast('Location created', 'success') }}
                      onRename={async (id, title) => { const loc = await window.api.locations.update({ id, name: title }); updateLocation(loc as any); addToast('Location renamed', 'success') }}
                      onDelete={async (id) => { await window.api.locations.delete(id); removeLocation(id); addToast('Location deleted', 'info') }}
                    />

                    {/* Relationships */}
                    <div style={{ padding: '0 10px', marginTop: 12 }}>
                      <button
                        onClick={() => openTab('relationships', 'relationship_manager', 'Relationships')}
                        style={{
                          width: '100%', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8,
                          color: F.green, background: 'none', border: 'none', borderRadius: 8,
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                          cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = F.greenLight; (e.currentTarget as HTMLElement).style.background = F.bgHover }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = F.green; (e.currentTarget as HTMLElement).style.background = 'none' }}
                      >
                        <Network style={{ width: 14, height: 14 }} />
                        Relationships
                      </button>
                    </div>

                    {/* Timeline Record */}
                    <div style={{ padding: '0 10px', marginTop: 12 }}>
                      <button
                        onClick={() => openTab('verse_timeline', 'verse_timeline', 'Timeline Record')}
                        style={{
                          width: '100%', padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8,
                          color: F.green, background: 'none', border: 'none', borderRadius: 8,
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                          cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = F.greenLight; (e.currentTarget as HTMLElement).style.background = F.bgHover }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = F.green; (e.currentTarget as HTMLElement).style.background = 'none' }}
                      >
                        <Clock style={{ width: 14, height: 14 }} />
                        Timeline Record
                      </button>
                    </div>

                    <EntityTree
                      title="Organizations" type="organization"
                      icon={<Building2 className="w-3.5 h-3.5 text-amber-400" />}
                      items={organizations.map(o => ({ id: o.id, title: o.title }))}
                      emptyMessage="No organizations yet." singularTitle="Organization"
                      onCreate={async (title) => { const item = await window.api.organizations.create({ bookId: currentBook.id, title }); addOrganization(item as any); addToast('Organization created', 'success') }}
                      onRename={async (id, title) => { const item = await window.api.organizations.update({ id, title }); updateOrganization(item as any); addToast('Organization renamed', 'success') }}
                      onDelete={async (id) => { await window.api.organizations.delete(id); removeOrganization(id); addToast('Organization deleted', 'info') }}
                    />

                    <EntityTree
                      title="World Rules" type="world_rule"
                      icon={<Gavel className="w-3.5 h-3.5 text-rose-400" />}
                      items={worldRules.map(w => ({ id: w.id, title: w.title }))}
                      emptyMessage="No rules yet." singularTitle="World Rule"
                      onCreate={async (title) => { const item = await window.api.worldRules.create({ bookId: currentBook.id, title }); addWorldRule(item as any); addToast('Rule created', 'success') }}
                      onRename={async (id, title) => { const item = await window.api.worldRules.update({ id, title }); updateWorldRule(item as any); addToast('Rule renamed', 'success') }}
                      onDelete={async (id) => { await window.api.worldRules.delete(id); removeWorldRule(id); addToast('Rule deleted', 'info') }}
                    />

                    <EntityTree
                      title="Codex" type="codex"
                      icon={<BookMarked className="w-3.5 h-3.5 text-purple-400" />}
                      items={codex.map(c => ({ id: c.id, title: c.title }))}
                      emptyMessage="No codex entries yet." singularTitle="Codex Entry"
                      onCreate={async (title) => { const item = await window.api.codex.create({ bookId: currentBook.id, title }); addCodex(item as any); addToast('Codex entry created', 'success') }}
                      onRename={async (id, title) => { const item = await window.api.codex.update({ id, title }); updateCodex(item as any); addToast('Codex entry renamed', 'success') }}
                      onDelete={async (id) => { await window.api.codex.delete(id); removeCodex(id); addToast('Codex entry deleted', 'info') }}
                    />

                    <EntityTree
                      title="Wiki" type="wiki"
                      icon={<Globe className="w-3.5 h-3.5 text-cyan-400" />}
                      items={wiki.map(w => ({ id: w.id, title: w.title }))}
                      emptyMessage="No wiki articles yet." singularTitle="Wiki Article"
                      onCreate={async (title) => { const item = await window.api.wiki.create({ bookId: currentBook.id, title }); addWiki(item as any); addToast('Wiki article created', 'success') }}
                      onRename={async (id, title) => { const item = await window.api.wiki.update({ id, title }); updateWiki(item as any); addToast('Wiki article renamed', 'success') }}
                      onDelete={async (id) => { await window.api.wiki.delete(id); removeWiki(id); addToast('Wiki article deleted', 'info') }}
                    />

                    <EntityTree
                      title="Notes" type="note"
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
          <div style={{ paddingTop: 4 }}>
            <button
              id="nav-dashboard"
              onClick={handleGoHome}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 16px)',
                margin: '2px 8px', padding: '8px 10px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: !bookId ? F.greenLight : 'transparent',
                color: !bookId ? F.green : F.textSoft,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (bookId) { (e.currentTarget as HTMLElement).style.background = F.bgHover; (e.currentTarget as HTMLElement).style.color = F.textMid } }}
              onMouseLeave={e => { if (bookId) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = F.textSoft } }}
            >
              <Home style={{ width: 16, height: 16, flexShrink: 0 }} />
              Dashboard
            </button>

            <div style={{ padding: '14px 12px 4px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: F.textFaint, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Books
              </span>
            </div>

            <BookList />
            <SharedBookList />
          </div>
        )}
      </div>

      {/* ── Bottom nav ───────────────────────────────────────── */}
      <div style={{ borderTop: `1px solid ${F.border}`, paddingTop: 6, paddingBottom: 6 }}>
        <button
          id="nav-settings"
          onClick={() => navigate('/settings')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: 'calc(100% - 16px)',
            margin: '2px 8px', padding: '8px 10px', borderRadius: 10, fontSize: 13, fontWeight: 500,
            color: F.textSoft, background: 'none', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = F.bgHover; (e.currentTarget as HTMLElement).style.color = F.textMid }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = F.textSoft }}
        >
          <Settings style={{ width: 16, height: 16, flexShrink: 0 }} />
          Settings
        </button>

        {/* User row */}
        <div style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: F.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden', border: `2px solid ${F.border}` }}>
            {localUser?.avatar_url ? (
              <img src={localUser.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: 'white', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                {user?.email?.[0] ?? 'U'}
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: F.textSoft, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.user_metadata?.display_name || user?.email}
          </span>
          <button
            id="nav-signout"
            onClick={handleSignOut}
            style={{ color: F.textFaint, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'color 0.15s', padding: 2 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ef4444'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = F.textFaint}
            title="Sign out"
          >
            <LogOut style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </div>
  )
}
