import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { cn, formatWordCount } from '../../utils'
import EditorTabs from '../../components/editor/EditorTabs'
import RichEditor from '../../components/editor/RichEditor'
import CharacterManager from '../../components/world/CharacterManager'
import LocationManager from '../../components/world/LocationManager'
import BookMaps from '../../components/world/map-editor/BookMaps'
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
import AIPanel from '../../components/ai/AIPanel'
import ExportModal from '../../components/export/ExportModal'
import ResizeHandle from '../../components/ui/ResizeHandle'
import { IconButton } from '../../components/ui/primitives'
import type { RightInspectorTab } from '../../types'
import { BookOpen, Download, PanelLeft, Sparkles, Heart, Shield, MessageSquare, Feather, Microscope } from 'lucide-react'

const INSPECTOR_STORAGE_KEY = 'wyt-inspector-width'
const DEFAULT_INSPECTOR_WIDTH = 336
const MIN_INSPECTOR_WIDTH = 270
const MAX_INSPECTOR_WIDTH = 540

function clampInspectorWidth(width: number) {
  return Math.max(MIN_INSPECTOR_WIDTH, Math.min(MAX_INSPECTOR_WIDTH, Math.round(width)))
}

function readStoredInspectorWidth(): number {
  try {
    const saved = Number(localStorage.getItem(INSPECTOR_STORAGE_KEY))
    return Number.isFinite(saved) && saved >= MIN_INSPECTOR_WIDTH ? clampInspectorWidth(saved) : DEFAULT_INSPECTOR_WIDTH
  } catch {
    return DEFAULT_INSPECTOR_WIDTH
  }
}

const inspectorTools: ReadonlyArray<{ id: RightInspectorTab; title: string; icon: typeof Sparkles; chapterOnly?: boolean }> = [
  { id: 'ai', title: 'AI Assistant', icon: Sparkles },
  { id: 'comments', title: 'Comments', icon: MessageSquare },
  { id: 'emotion', title: 'Emotional Intelligence', icon: Heart, chapterOnly: true },
  { id: 'continuity', title: 'Continuity Engine', icon: Shield, chapterOnly: true },
  { id: 'style', title: 'Style Intelligence', icon: Feather, chapterOnly: true },
  { id: 'worldbuilding', title: 'Worldbuilding Analyzer', icon: Microscope, chapterOnly: true },
]

export default function EditorView() {
  const {
    activeTabId, activeChapter, tabs,
    currentBook, toggleSidebar, toggleRightPanel, setActiveRightPanel, setPanelWidths,
    panelState, focusMode, mapEditorFocused
  } = useWorkspaceStore()
  const [wordCount, setWordCount] = useState(activeChapter?.word_count ?? 0)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [inspectorWidth, setInspectorWidth] = useState<number>(() =>
    panelState.inspectorWidth ? clampInspectorWidth(panelState.inspectorWidth) : readStoredInspectorWidth()
  )
  const [resizing, setResizing] = useState(false)

  useEffect(() => {
    if (panelState.inspectorWidth && !resizing) {
      setInspectorWidth(clampInspectorWidth(panelState.inspectorWidth))
    }
  }, [panelState.inspectorWidth, resizing])

  // Sync wordcount
  useEffect(() => {
    if (activeTabId && tabs.find(t => t.id === activeTabId)?.type === 'chapter') {
      setWordCount(activeChapter?.word_count ?? 0)
    } else {
      setWordCount(0)
    }
  }, [activeTabId, activeChapter?.id])

  useEffect(() => {
    const openComments = () => setActiveRightPanel('comments')
    const openAIPolish = () => setActiveRightPanel('ai')
    const openExport = () => {
      if (useWorkspaceStore.getState().currentBook) setIsExportOpen(true)
    }
    window.addEventListener('open-comment-sidebar', openComments)
    window.addEventListener('open-ai-polish', openAIPolish)
    window.addEventListener('open-book-export', openExport)
    return () => {
      window.removeEventListener('open-comment-sidebar', openComments)
      window.removeEventListener('open-ai-polish', openAIPolish)
      window.removeEventListener('open-book-export', openExport)
    }
  }, [setActiveRightPanel])

  const activeRightPanel: RightInspectorTab | null =
    panelState.activeRightPanel !== undefined
      ? panelState.activeRightPanel
      : (panelState.aiPanelOpen ? 'ai' : null)

  function closePanel() {
    if (activeRightPanel) document.getElementById(`editor-toggle-${activeRightPanel}`)?.focus()
    setActiveRightPanel(null)
  }

  const commitInspectorWidth = (width: number) => {
    const clamped = clampInspectorWidth(width)
    try { localStorage.setItem(INSPECTOR_STORAGE_KEY, String(clamped)) } catch {}
    setPanelWidths({ inspectorWidth: clamped })
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
  const isChapterActive = activeTab.type === 'chapter' && Boolean(activeChapter)
  const commentSubjectId = activeTab.type === 'chapter' && activeChapter ? activeChapter.id : activeTab.entityId || activeTab.id

  const visibleRightPanel: RightInspectorTab | null =
    !activeRightPanel || isMaps || mapEditorFocused || focusMode
      ? null
      : (activeRightPanel === 'ai' || activeRightPanel === 'comments' || isChapterActive)
        ? activeRightPanel
        : null

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Chapter tabs */}
      {!mapEditorFocused && <EditorTabs />}

      {/* Chapter header */}
      {!mapEditorFocused && (
        <div
          className={cn(
            'flex shrink-0 items-center gap-3 px-4',
            activeTab.type === 'chapter'
              ? 'studio-chapter-header py-2.5 md:px-6'
              : 'border-b border-[hsl(var(--studio-edge))] bg-surface-950 py-2'
          )}
        >
          {/* Sidebar toggle (when sidebar hidden) */}
          {!panelState.sidebarOpen && (
            <IconButton
              id="editor-toggle-sidebar"
              onClick={toggleSidebar}
              title="Show sidebar"
              aria-label="Show sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </IconButton>
          )}

          <div className="min-w-0 flex-1">
            {currentBook && <p className="mb-0.5 truncate text-xs font-medium text-surface-400">{currentBook.title}</p>}
            {!isProfile && (
              <h2
                title={activeTab.title}
                className={cn(
                  'truncate font-bold leading-tight text-surface-50',
                  activeTab.type === 'chapter' ? 'text-xl md:text-2xl' : 'text-base'
                )}
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {activeTab.title}
              </h2>
            )}
          </div>

          <div id="editor-find-slot" className="min-w-0 empty:hidden" />

          {!isMaps && !isProfile && activeTab.type !== 'relationship_manager' && (
            <span className="shrink-0 whitespace-nowrap rounded-md bg-[hsl(var(--brand-green-bg))] px-2.5 py-1 text-xs font-medium tabular-nums text-[hsl(var(--brand-green))]">
              {formatWordCount(wordCount)}
            </span>
          )}

          {currentBook && !isMaps && (
            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              title="Export book (PDF, DOCX, EPUB, Markdown, Audiobook)"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] px-2.5 py-1 text-xs font-medium text-surface-200 transition-colors hover:bg-surface-850"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}
        </div>
      )}

      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-hidden relative flex bg-surface-950 min-h-0">
        <div className="flex-1 overflow-hidden relative min-w-0">
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

        {/* Unified Resizable Right Inspector */}
        {visibleRightPanel && (
          <>
            <ResizeHandle
              aria-label="Resize inspector"
              onResize={delta => {
                setResizing(true)
                setInspectorWidth(current => clampInspectorWidth(current - delta))
              }}
              onResizeEnd={() => {
                setResizing(false)
                setInspectorWidth(current => {
                  commitInspectorWidth(current)
                  return current
                })
              }}
              onReset={() => {
                setInspectorWidth(DEFAULT_INSPECTOR_WIDTH)
                commitInspectorWidth(DEFAULT_INSPECTOR_WIDTH)
              }}
            />
            <div
              style={{ width: inspectorWidth }}
              className={cn(
                'h-full min-h-0 shrink-0 overflow-hidden border-l border-[hsl(var(--studio-edge))]',
                !resizing && 'panel-transition'
              )}
            >
              {visibleRightPanel === 'ai' && <AIPanel />}
              {visibleRightPanel === 'comments' && (
                <CommentSidebar
                  key={commentSubjectId}
                  chapterId={commentSubjectId}
                  isOpen
                  onClose={closePanel}
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
              {visibleRightPanel === 'emotion' && activeChapter && <EmotionPanel key={activeChapter.id} chapterId={activeChapter.id} onClose={closePanel} />}
              {visibleRightPanel === 'continuity' && activeChapter && <ContinuityPanel key={activeChapter.id} chapterId={activeChapter.id} onClose={closePanel} />}
              {visibleRightPanel === 'style' && activeChapter && <StyleIntelligencePanel key={activeChapter.id} chapterId={activeChapter.id} onClose={closePanel} />}
              {visibleRightPanel === 'worldbuilding' && activeChapter && <WorldbuildingAnalyzerPanel key={activeChapter.id} chapterId={activeChapter.id} onClose={closePanel} />}
            </div>
          </>
        )}

        {!isMaps && !mapEditorFocused && !focusMode && (
          <nav aria-label="Inspector tools" className="flex w-11 shrink-0 flex-col items-center gap-2 border-l border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-header))] py-3">
            {inspectorTools.map(({ id, title, icon: Icon, chapterOnly }, index) => {
              const disabled = Boolean(chapterOnly && !isChapterActive)
              const expanded = !disabled && activeRightPanel === id
              return (
                <div key={id} className="flex flex-col items-center">
                  {index === 2 && <div className="my-1.5 h-px w-6 bg-[hsl(var(--studio-edge))]" />}
                  <button
                    type="button"
                    id={`editor-toggle-${id}`}
                    disabled={disabled}
                    aria-label={title}
                    aria-expanded={expanded}
                    aria-controls={expanded ? `${id}-panel` : undefined}
                    title={disabled ? `${title} (chapters only)` : title}
                    onClick={() => toggleRightPanel(id)}
                    className={cn(
                      'rounded-lg p-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--brand-green))] disabled:cursor-not-allowed disabled:opacity-40',
                      expanded
                        ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                        : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100'
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )
            })}
          </nav>
        )}
      </div>

      {currentBook && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          book={currentBook}
        />
      )}
    </div>
  )
}
