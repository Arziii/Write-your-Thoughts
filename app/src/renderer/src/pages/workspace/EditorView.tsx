import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn, formatWordCount } from '../../utils'
import EditorTabs from '../../components/editor/EditorTabs'
import RichEditor from '../../components/editor/RichEditor'
import CharacterManager from '../../components/world/CharacterManager'
import LocationManager from '../../components/world/LocationManager'
import BookMaps from '../../components/world/BookMaps'
import ReferencePageEditor from '../../components/world/ReferencePageEditor'
import { isReferenceKind } from '../../../../shared/referencePages'
import CalendarView from '../../components/world/CalendarView'
import VerseTimelineView from '../../components/world/VerseTimelineView'
import CommentSidebar from '../../components/editor/CommentSidebar'
import EmotionPanel from '../../components/editor/EmotionPanel'
import ContinuityPanel from '../../components/editor/ContinuityPanel'
import StyleIntelligencePanel from '../../components/editor/StyleIntelligencePanel'
import WorldbuildingAnalyzerPanel from '../../components/editor/WorldbuildingAnalyzerPanel'
import StoryIntelligenceView from '../../components/world/StoryIntelligenceView'
import GlobalRelationshipManager from '../../components/world/GlobalRelationshipManager'
import { BookOpen, PanelLeft, Sparkles, Heart, Shield, MessageSquare, Feather, Microscope } from 'lucide-react'

const editorTools = [
  { id: 'comments', title: 'Comments', icon: MessageSquare },
  { id: 'emotion', title: 'Emotional Intelligence', icon: Heart },
  { id: 'continuity', title: 'Continuity Engine', icon: Shield },
  { id: 'style', title: 'Style Intelligence', icon: Feather },
  { id: 'worldbuilding', title: 'Worldbuilding Analyzer', icon: Microscope },
] as const

type EditorTool = typeof editorTools[number]['id']

export default function EditorView() {
  const {
    activeTabId, activeChapter, tabs,
    currentBook, toggleSidebar, toggleAIPanel, panelState, mapEditorFocused
  } = useWorkspaceStore()
  const [wordCount, setWordCount] = useState(activeChapter?.word_count ?? 0)

  // Sync wordcount
  useEffect(() => {
    if (activeTabId && tabs.find(t => t.id === activeTabId)?.type === 'chapter') {
      setWordCount(activeChapter?.word_count ?? 0)
    } else {
      setWordCount(0)
    }
  }, [activeTabId, activeChapter?.id])

  const [openPanel, setOpenPanel] = useState<EditorTool | null>(null)

  useEffect(() => {
    const openComments = () => setOpenPanel('comments')
    window.addEventListener('open-comment-sidebar', openComments)
    return () => window.removeEventListener('open-comment-sidebar', openComments)
  }, [])

  function closePanel() {
    if (openPanel) document.getElementById(`editor-toggle-${openPanel}`)?.focus()
    setOpenPanel(null)
  }

  if (!activeTabId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-950 text-center px-8">
        <div>
          <BookOpen className="w-12 h-12 text-surface-700 mx-auto mb-4" />
          <p className="text-surface-400 font-medium mb-1">No tab open</p>
          <p className="text-surface-600 text-sm">Select a chapter or worldbuilding item from the sidebar to start.</p>
        </div>
      </div>
    )
  }

  const activeTab = tabs.find(t => t.id === activeTabId)
  if (!activeTab) return null
  const isMaps = activeTab.type === 'maps'
  const isProfile = activeTab.type === 'character' || activeTab.type === 'location'
  const commentSubjectId = activeTab.type === 'chapter' && activeChapter ? activeChapter.id : activeTab.entityId || activeTab.id

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Chapter tabs */}
      {!mapEditorFocused && <EditorTabs />}

      {/* Chapter header */}
      {!mapEditorFocused && <div
        className={`flex shrink-0 items-center gap-3 px-4 ${activeTab.type === 'chapter' ? 'studio-chapter-header py-3 md:px-6' : 'py-2'}`}
        style={{
          ...(activeTab.type !== 'chapter' && {
            background: 'hsl(var(--surface-950))',
            borderBottom: '1px solid hsl(var(--surface-800))',
          }),
        }}
      >
        {/* Sidebar toggle (when sidebar hidden) */}
        {!panelState.sidebarOpen && (
          <button
            id="editor-toggle-sidebar"
            onClick={toggleSidebar}
            style={{ color: 'hsl(var(--surface-500))', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'hsl(var(--surface-300))'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'hsl(var(--surface-500))'}
            title="Show sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          {currentBook && <p className="mb-0.5 truncate text-xs font-medium text-surface-400">{currentBook.title}</p>}
          {!isProfile && <h2 title={activeTab.title} className={`truncate font-bold leading-tight text-surface-50 ${activeTab.type === 'chapter' ? 'text-xl md:text-2xl' : 'text-base'}`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {activeTab.title}
          </h2>}
        </div>

        <div id="editor-find-slot" className="min-w-0 empty:hidden" />

        {!isMaps && !isProfile && activeTab.type !== 'relationship_manager' && (
          <span className="shrink-0 whitespace-nowrap rounded-md bg-[hsl(var(--brand-green-bg))] px-2.5 py-1 text-xs font-medium tabular-nums text-[hsl(var(--brand-green))]">
            {formatWordCount(wordCount)}
          </span>
        )}

        {/* AI panel toggle (when AI panel hidden) */}
        {!panelState.aiPanelOpen && !isMaps && (
          <button
            id="editor-toggle-ai"
            onClick={toggleAIPanel}
            style={{ color: 'hsl(var(--surface-500))', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'hsl(var(--accent-600))'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'hsl(var(--surface-500))'}
            title="Show AI panel"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
      </div>}

      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-hidden relative flex" style={{ background: 'hsl(var(--surface-950))' }}>
        <div className="flex-1 overflow-hidden relative">
          {activeTab.type === 'chapter' && activeChapter && (
            <RichEditor
              key={`chapter-${activeChapter.id}`}
              chapterId={activeChapter.id}
              initialContent={activeChapter.content}
              onContentChange={(_html, wc) => setWordCount(wc)}
            />
          )}
          {activeTab.type === 'character' && <CharacterManager key={`char-${activeTab.entityId}`} entityId={activeTab.entityId} />}
          {activeTab.type === 'location' && <LocationManager key={`loc-${activeTab.entityId}`} entityId={activeTab.entityId} />}
          {isMaps && currentBook && <BookMaps key={currentBook.id} bookId={currentBook.id} />}
          {isReferenceKind(activeTab.type) && (
            <ReferencePageEditor key={`${activeTab.type}-${activeTab.entityId}`}
              kind={activeTab.type} entityId={activeTab.entityId} onWordCountChange={setWordCount} />
          )}
          {activeTab.type === 'timeline' && <CalendarView key={`calendar-${activeTab.entityId}`} />}
          {activeTab.type === 'story_intelligence' && <StoryIntelligenceView key={`story_intel-${activeTab.entityId}`} />}
          {activeTab.type === 'relationship_manager' && <GlobalRelationshipManager key={`rel_mgr-${activeTab.id}`} />}
          {activeTab.type === 'verse_timeline' && <VerseTimelineView key={`verse_timeline-${activeTab.id}`} />}
        </div>
        
        {!isMaps && (
          <CommentSidebar key={commentSubjectId} chapterId={commentSubjectId}
            isOpen={openPanel === 'comments'} onClose={closePanel}
            onResolve={async (id) => {
              await window.api.comments.resolve(id)
              window.dispatchEvent(new CustomEvent('refresh-comments'))
              window.dispatchEvent(new CustomEvent('comment-removed', { detail: { id } }))
            }}
            onDelete={async (id) => {
              await window.api.comments.delete(id)
              window.dispatchEvent(new CustomEvent('refresh-comments'))
              window.dispatchEvent(new CustomEvent('comment-removed', { detail: { id } }))
            }}
          />
        )}

        {activeTab.type === 'chapter' && activeChapter && (
          <>
            {openPanel === 'emotion' && <EmotionPanel key={activeChapter.id} chapterId={activeChapter.id} onClose={closePanel} />}
            {openPanel === 'continuity' && <ContinuityPanel key={activeChapter.id} chapterId={activeChapter.id} onClose={closePanel} />}
            {openPanel === 'style' && <StyleIntelligencePanel key={activeChapter.id} chapterId={activeChapter.id} onClose={closePanel} />}
            {openPanel === 'worldbuilding' && <WorldbuildingAnalyzerPanel key={activeChapter.id} chapterId={activeChapter.id} onClose={closePanel} />}
          </>
        )}

        {!isMaps && (
          <nav aria-label="Editor tools" className="flex w-12 shrink-0 flex-col items-center gap-3 border-l border-surface-800 bg-[hsl(var(--studio-header))] py-4">
            {editorTools.map(({ id, title, icon: Icon }) => {
              const disabled = id !== 'comments' && (activeTab.type !== 'chapter' || !activeChapter)
              const expanded = !disabled && openPanel === id
              return (
                <button key={id} type="button" id={`editor-toggle-${id}`} disabled={disabled} aria-label={title}
                  aria-expanded={expanded} aria-controls={expanded ? `${id}-panel` : undefined}
                  title={disabled ? `${title} (chapters only)` : title}
                  onClick={() => setOpenPanel(current => current === id ? null : id)}
                  className={cn(
                    'rounded-lg p-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40',
                    expanded
                      ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                      : 'text-surface-400 hover:bg-surface-800 hover:text-surface-100',
                  )}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              )
            })}
          </nav>
        )}
      </div>
    </div>
  )
}
