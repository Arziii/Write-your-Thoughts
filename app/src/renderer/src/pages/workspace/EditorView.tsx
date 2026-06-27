import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { formatWordCount } from '../../utils'
import EditorTabs from '../../components/editor/EditorTabs'
import RichEditor from '../../components/editor/RichEditor'
import CharacterManager from '../../components/world/CharacterManager'
import LocationManager from '../../components/world/LocationManager'
import NoteEditor from '../../components/world/NoteEditor'
import CodexEditor from '../../components/world/CodexEditor'
import WikiEditor from '../../components/world/WikiEditor'
import OrganizationEditor from '../../components/world/OrganizationEditor'
import WorldRuleEditor from '../../components/world/WorldRuleEditor'
import CalendarView from '../../components/world/CalendarView'
import VerseTimelineView from '../../components/world/VerseTimelineView'
import CommentSidebar from '../../components/editor/CommentSidebar'
import EmotionPanel from '../../components/editor/EmotionPanel'
import ContinuityPanel from '../../components/editor/ContinuityPanel'
import StyleIntelligencePanel from '../../components/editor/StyleIntelligencePanel'
import StoryIntelligenceView from '../../components/world/StoryIntelligenceView'
import GlobalRelationshipManager from '../../components/world/GlobalRelationshipManager'
import type { Chapter } from '../../types'
import { BookOpen, PanelLeft, Sparkles, Heart, Shield, MessageSquare, Feather } from 'lucide-react'

export default function EditorView() {
  const { chapterId } = useParams()
  const { 
    activeTabId, activeChapter, tabs, chapters, 
    currentBook, toggleSidebar, toggleAIPanel, panelState 
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

  const [isCommentSidebarOpen, setIsCommentSidebarOpen] = useState(false)
  const [isEmotionPanelOpen, setIsEmotionPanelOpen] = useState(false)
  const [isContinuityPanelOpen, setIsContinuityPanelOpen] = useState(false)
  const [isStylePanelOpen, setIsStylePanelOpen] = useState(false)

  const togglePanel = (panel: 'comments' | 'emotion' | 'continuity' | 'style') => {
    if (panel === 'comments') {
      setIsCommentSidebarOpen(!isCommentSidebarOpen)
      setIsEmotionPanelOpen(false)
      setIsContinuityPanelOpen(false)
      setIsStylePanelOpen(false)
    } else if (panel === 'emotion') {
      setIsEmotionPanelOpen(!isEmotionPanelOpen)
      setIsCommentSidebarOpen(false)
      setIsContinuityPanelOpen(false)
      setIsStylePanelOpen(false)
    } else if (panel === 'continuity') {
      setIsContinuityPanelOpen(!isContinuityPanelOpen)
      setIsCommentSidebarOpen(false)
      setIsEmotionPanelOpen(false)
      setIsStylePanelOpen(false)
    } else if (panel === 'style') {
      setIsStylePanelOpen(!isStylePanelOpen)
      setIsCommentSidebarOpen(false)
      setIsEmotionPanelOpen(false)
      setIsContinuityPanelOpen(false)
    }
  }

  useEffect(() => {
    const handleOpenSidebar = (e: Event) => {
      togglePanel('comments')
    }
    window.addEventListener('open-comment-sidebar', handleOpenSidebar)
    return () => window.removeEventListener('open-comment-sidebar', handleOpenSidebar)
  }, [isCommentSidebarOpen])

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

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Chapter tabs */}
      <EditorTabs />

      {/* Chapter header */}
      <div 
        className="flex items-center gap-4 px-4 py-2 flex-shrink-0"
        style={{
          background: '#fffefb',
          borderBottom: '1px solid #d0c9bc',
        }}
      >
        {/* Sidebar toggle (when sidebar hidden) */}
        {!panelState.sidebarOpen && (
          <button
            id="editor-toggle-sidebar"
            onClick={toggleSidebar}
            style={{ color: '#7a8c77', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#3d5c3a'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#7a8c77'}
            title="Show sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex-1">
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: '#1a2e18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeTab.title}
          </h2>
          <p style={{ fontSize: 11, color: '#7a8c77' }}>{currentBook?.title}</p>
        </div>

        <div className="flex items-center gap-3 text-xs" style={{ color: '#7a8c77', fontWeight: 500 }}>
          <span>{formatWordCount(wordCount)} words</span>
        </div>

        {/* AI panel toggle (when AI panel hidden) */}
        {!panelState.aiPanelOpen && (
          <button
            id="editor-toggle-ai"
            onClick={toggleAIPanel}
            style={{ color: '#7a8c77', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2d5a27'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#7a8c77'}
            title="Show AI panel"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dynamic Content Area */}
      <div className="flex-1 overflow-hidden relative flex" style={{ background: '#fffefb' }}>
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
          {activeTab.type === 'note' && <NoteEditor key={`note-${activeTab.entityId}`} entityId={activeTab.entityId} onWordCountChange={setWordCount} />}
          {activeTab.type === 'codex' && <CodexEditor key={`codex-${activeTab.entityId}`} entityId={activeTab.entityId} onWordCountChange={setWordCount} />}
          {activeTab.type === 'wiki' && <WikiEditor key={`wiki-${activeTab.entityId}`} entityId={activeTab.entityId} onWordCountChange={setWordCount} />}
          {activeTab.type === 'organization' && <OrganizationEditor key={`org-${activeTab.entityId}`} entityId={activeTab.entityId} onWordCountChange={setWordCount} />}
          {activeTab.type === 'world_rule' && <WorldRuleEditor key={`rule-${activeTab.entityId}`} entityId={activeTab.entityId} onWordCountChange={setWordCount} />}
          {activeTab.type === 'timeline' && <CalendarView key={`calendar-${activeTab.entityId}`} />}
          {activeTab.type === 'story_intelligence' && <StoryIntelligenceView key={`story_intel-${activeTab.entityId}`} />}
          {activeTab.type === 'relationship_manager' && <GlobalRelationshipManager key={`rel_mgr-${activeTab.id}`} />}
          {activeTab.type === 'verse_timeline' && <VerseTimelineView key={`verse_timeline-${activeTab.id}`} />}
        </div>
        
        {/* Comments Sidebar for Chapters */}
        {activeTab.type === 'chapter' && activeChapter && (
          <CommentSidebar
            chapterId={activeChapter.id}
            isOpen={isCommentSidebarOpen}
            onClose={() => setIsCommentSidebarOpen(false)}
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

        {/* Emotional Intelligence Panel */}
        {activeTab.type === 'chapter' && activeChapter && isEmotionPanelOpen && (
          <EmotionPanel chapterId={activeChapter.id} />
        )}

        {/* Continuity Panel */}
        {activeTab.type === 'chapter' && activeChapter && isContinuityPanelOpen && (
          <ContinuityPanel chapterId={activeChapter.id} />
        )}

        {/* Style Intelligence Panel */}
        {activeTab.type === 'chapter' && activeChapter && isStylePanelOpen && (
          <StyleIntelligencePanel chapterId={activeChapter.id} />
        )}
        
        {/* Right Vertical Tool Sidebar */}
        {activeTab.type === 'chapter' && (
          <div 
            className="w-12 flex flex-col items-center py-4 gap-4 flex-shrink-0"
            style={{
              background: '#f0ece4',
              borderLeft: '1px solid #d0c9bc'
            }}
          >
            <button
              onClick={() => togglePanel('comments')}
              className={`p-2 rounded-lg transition-colors ${isCommentSidebarOpen ? 'bg-[#fffefb] text-[#2d5a27] shadow-sm' : 'text-[#7a8c77] hover:text-[#3d5c3a] hover:bg-[#e8e2d8]'}`}
              title="Comments"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={() => togglePanel('emotion')}
              className={`p-2 rounded-lg transition-colors ${isEmotionPanelOpen ? 'bg-[#fffefb] text-[#2d5a27] shadow-sm' : 'text-[#7a8c77] hover:text-[#3d5c3a] hover:bg-[#e8e2d8]'}`}
              title="Emotional Intelligence"
            >
              <Heart className="w-4 h-4" />
            </button>
            <button
              onClick={() => togglePanel('continuity')}
              className={`p-2 rounded-lg transition-colors ${isContinuityPanelOpen ? 'bg-[#fffefb] text-[#2d5a27] shadow-sm' : 'text-[#7a8c77] hover:text-[#3d5c3a] hover:bg-[#e8e2d8]'}`}
              title="Continuity Engine"
            >
              <Shield className="w-4 h-4" />
            </button>
            <button
              onClick={() => togglePanel('style')}
              className={`p-2 rounded-lg transition-colors ${isStylePanelOpen ? 'bg-[#fffefb] text-[#2d5a27] shadow-sm' : 'text-[#7a8c77] hover:text-[#3d5c3a] hover:bg-[#e8e2d8]'}`}
              title="Style Intelligence"
            >
              <Feather className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
