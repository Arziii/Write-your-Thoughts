import { useState } from 'react'
import {
  Sparkles, CheckCheck, X, Loader2, History, ChevronDown,
  RotateCcw, Zap, AlignLeft, Maximize2, PanelRight, Copy, RefreshCcw, Trash2
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useToastStore } from '../../stores/toastStore'
import { aiService } from '../../services/aiService'
import type { AIPolishResult, ChapterVersion, AIMode, AIBrainstormMessage } from '../../types'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { cn, formatDate } from '../../utils'
import VersionHistory from './VersionHistory'
import Modal from '../ui/Modal'

const modeDescriptions: Record<AIMode, string> = {
  grammar: 'Fix grammar & punctuation only',
  balanced: 'Improve flow & clarity',
  strong: 'Significantly enhance readability',
  expand: 'Add descriptive details and length',
  shorten: 'Condense and make punchy',
  describe: 'Enhance sensory details',
  custom: 'Follow custom instruction',
}

export default function AIPanel() {
  const { activeChapter, updateChapter, characters, locations, timelineEvents, toggleAIPanel, panelState } = useWorkspaceStore()
  const { settings } = useUserStore()
  const { addToast } = useToastStore()
  const { verseTimelineEvents } = useStoryBibleStore()

  const [isPolishing, setIsPolishing] = useState(false)
  const [polishResult, setPolishResult] = useState<AIPolishResult | null>(null)
  const [mode, setMode] = useState<AIMode>('grammar')
  const [customInstruction, setCustomInstruction] = useState('')
  const [activeTab, setActiveTab] = useState<'polish' | 'history' | 'brainstorm'>('polish')
  const [showModeMenu, setShowModeMenu] = useState(false)

  // Brainstorm state
  const [brainstormMessages, setBrainstormMessages] = useState<AIBrainstormMessage[]>([])
  const [brainstormInput, setBrainstormInput] = useState('')
  const [isBrainstorming, setIsBrainstorming] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handlePolish = async () => {
    if (!activeChapter || !settings?.ai_api_key) {
      if (!settings?.ai_api_key) {
        addToast('Set your AI API key in Settings first', 'warning')
        return
      }
      addToast('Open a chapter to polish', 'info')
      return
    }

    setIsPolishing(true)
    setPolishResult(null)

    try {
      // Build story context by finding matching entities in the chapter content
      const chapterText = activeChapter.content.replace(/<[^>]*>/g, '')
      let storyContext = ''

      // Include auto-matched and locked entities
      const lockedIds = panelState.lockedEntities || []
      const matchedCharacters = characters.filter(c => lockedIds.includes(c.id) || chapterText.includes(c.name) || (c.nickname && chapterText.includes(c.nickname)))
      if (matchedCharacters.length > 0) {
        storyContext += 'CHARACTERS:\n' + matchedCharacters.map(c => `- ${c.name} (Age: ${c.age}, Gender: ${c.gender}): ${c.appearance}. ${c.personality}. Goals: ${c.goals}`).join('\n') + '\n\n'
      }

      const matchedLocations = locations.filter(l => lockedIds.includes(l.id) || chapterText.includes(l.name))
      if (matchedLocations.length > 0) {
        storyContext += 'LOCATIONS:\n' + matchedLocations.map(l => `- ${l.name}: ${l.description}. Culture: ${l.culture}`).join('\n') + '\n\n'
      }

      if (verseTimelineEvents.length > 0) {
        storyContext += 'VERSE TIMELINE RECORD (Global World Events):\n' + [...verseTimelineEvents].sort((a,b) => (a.sort_order||0)-(b.sort_order||0)).map(e => `- ${e.event_date ? `[${e.event_date}] ` : ''}${e.title}: ${e.description}`).join('\n') + '\n\n'
      }

      // Save version before polishing
      await window.api.chapters.saveVersion({
        chapterId: activeChapter.id,
        content: activeChapter.content,
        source: 'manual',
      })

      const result = await aiService.polishText({
        content: activeChapter.content,
        provider: settings.ai_provider || 'openai',
        apiKey: settings.ai_api_key,
        mode,
        stylePrompt: settings.ai_style_prompt,
        preserveFormatting: settings.preserve_formatting ?? true,
        storyContext: storyContext.trim(),
        customInstruction: mode === 'custom' ? customInstruction : undefined,
      })

      setPolishResult(result)
      addToast('Polish complete! Review the changes below.', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI polish failed'
      addToast(msg, 'error')
    } finally {
      setIsPolishing(false)
    }
  }

  const handleAccept = async () => {
    if (!polishResult || !activeChapter) return
    try {
      // Save AI output as new version
      await window.api.chapters.saveVersion({
        chapterId: activeChapter.id,
        content: polishResult.polishedContent,
        source: 'ai_polish',
      })
      // Save to chapter
      const wc = polishResult.polishedContent.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length
      await window.api.chapters.save({
        id: activeChapter.id,
        content: polishResult.polishedContent,
        wordCount: wc,
      })
      updateChapter({ ...activeChapter, content: polishResult.polishedContent, word_count: wc })
      setPolishResult(null)
      addToast('AI edits accepted', 'success')
    } catch {
      addToast('Failed to apply changes', 'error')
    }
  }

  const handleReject = () => {
    setPolishResult(null)
    addToast('AI edits rejected', 'info')
  }

  const handleBrainstorm = async (overrideInput?: string) => {
    const inputToUse = overrideInput ?? brainstormInput
    if (!inputToUse.trim() || !settings?.ai_api_key) {
      if (!settings?.ai_api_key) addToast('Set your AI API key in Settings first', 'warning')
      return
    }

    const newMessages: AIBrainstormMessage[] = [
      ...brainstormMessages,
      { role: 'user', content: inputToUse }
    ]
    setBrainstormMessages(newMessages)
    setBrainstormInput('')
    setIsBrainstorming(true)

    try {
      let storyContext = ''
      const lockedIds = panelState.lockedEntities || []
      
      const matchedCharacters = characters.filter(c => lockedIds.includes(c.id))
      if (matchedCharacters.length > 0) {
        storyContext += 'CHARACTERS:\n' + matchedCharacters.map(c => `- ${c.name} (Age: ${c.age}, Gender: ${c.gender}): ${c.appearance}. ${c.personality}. Goals: ${c.goals}`).join('\n') + '\n\n'
      }

      const matchedLocations = locations.filter(l => lockedIds.includes(l.id))
      if (matchedLocations.length > 0) {
        storyContext += 'LOCATIONS:\n' + matchedLocations.map(l => `- ${l.name}: ${l.description}. Culture: ${l.culture}`).join('\n') + '\n\n'
      }

      if (verseTimelineEvents.length > 0) {
        storyContext += 'VERSE TIMELINE RECORD (Global World Events):\n' + [...verseTimelineEvents].sort((a,b) => (a.sort_order||0)-(b.sort_order||0)).map(e => `- ${e.event_date ? `[${e.event_date}] ` : ''}${e.title}: ${e.description}`).join('\n') + '\n\n'
      }

      const response = await aiService.brainstorm({
        messages: newMessages,
        provider: settings.ai_provider || 'openai',
        apiKey: settings.ai_api_key,
        storyContext: storyContext.trim(),
      })

      setBrainstormMessages([...newMessages, { role: 'assistant', content: response }])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Brainstorming failed'
      addToast(msg, 'error')
    } finally {
      setIsBrainstorming(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    addToast('Copied to clipboard', 'success')
  }

  return (
    <div className="flex flex-col h-full bg-surface-900 w-80" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-800 h-9">
        <div className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-accent-400" />
          <span className="text-xs font-semibold text-surface-300">AI Assistant</span>
        </div>
        <button
          onClick={toggleAIPanel}
          className="text-surface-600 hover:text-surface-300 transition-colors"
          title="Collapse AI Panel"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-800">
        {[
          { id: 'polish', label: 'Polish', icon: Zap },
          { id: 'brainstorm', label: 'Brainstorm', icon: Sparkles },
          { id: 'history', label: 'History', icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`ai-tab-${id}`}
            onClick={() => setActiveTab(id as 'polish' | 'history' | 'brainstorm')}
            className={cn(
              'flex items-center justify-center gap-1.5 flex-1 py-2 text-xs font-medium transition-colors',
              activeTab === id
                ? 'text-accent-400 border-b-2 border-accent-500'
                : 'text-surface-500 hover:text-surface-300'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'polish' ? (
          <>
            {/* Chapter info */}
            {activeChapter ? (
              <div className="glass-card rounded-lg p-3">
                <p className="text-xs text-surface-400 mb-0.5">Editing</p>
                <p className="text-sm text-surface-200 font-medium truncate">{activeChapter.title}</p>
                <p className="text-xs text-surface-500 mt-0.5">{activeChapter.word_count} words</p>
              </div>
            ) : (
              <div className="glass-card rounded-lg p-3 text-center">
                <p className="text-xs text-surface-500">Open a chapter to use AI features.</p>
              </div>
            )}

            {/* Mode selector */}
            <div className="relative">
              <button
                id="ai-mode-selector"
                onClick={() => setShowModeMenu(!showModeMenu)}
                className="w-full flex items-center justify-between px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-surface-200 hover:border-surface-600 transition-colors"
              >
                <span className="capitalize font-medium text-xs">{mode}</span>
                <ChevronDown className={cn('w-3.5 h-3.5 text-surface-500 transition-transform', showModeMenu && 'rotate-180')} />
              </button>
              {showModeMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowModeMenu(false)} />
                  <div className="absolute top-full left-0 right-0 mt-1 z-40 bg-surface-800 border border-surface-700 rounded-lg shadow-xl overflow-hidden animate-fade-in">
                    {(Object.entries(modeDescriptions) as [AIMode, string][]).map(([m, desc]) => (
                      <button
                        key={m}
                        id={`ai-mode-${m}`}
                        onClick={() => { setMode(m); setShowModeMenu(false) }}
                        className={cn(
                          'flex flex-col items-start w-full px-3 py-2.5 text-left hover:bg-surface-700 transition-colors',
                          mode === m && 'bg-surface-700'
                        )}
                      >
                        <span className="text-xs font-medium text-surface-200 capitalize">{m}</span>
                        <span className="text-[10px] text-surface-500 mt-0.5">{desc}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Custom Instruction Input */}
            {mode === 'custom' && (
              <div className="space-y-1 animate-fade-in">
                <label className="text-xs font-medium text-surface-400 px-1">Custom Instruction</label>
                <textarea
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="E.g., Rewrite this in the style of Edgar Allan Poe..."
                  className="w-full h-20 bg-surface-800 border border-surface-700 rounded-lg p-2.5 text-sm text-surface-200 placeholder-surface-500 focus:outline-none focus:border-accent-500 resize-none"
                />
              </div>
            )}

            {/* Polish button */}
            <button
              id="ai-polish-btn"
              onClick={handlePolish}
              disabled={isPolishing || !activeChapter}
              className="w-full py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              {isPolishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Polishing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Polish with AI
                </>
              )}
            </button>

            {/* No API key warning */}
            {!settings?.ai_api_key && (
              <p className="text-[11px] text-warning-400 text-center px-2">
                ⚠ Set an AI API key in Settings to enable polish.
              </p>
            )}

            {/* AI Result */}
            {polishResult && (
              <div className="space-y-3 animate-fade-in">
                <div className="border border-surface-700 rounded-lg overflow-hidden">
                  {/* Explanation */}
                  <div className="px-3 py-2.5 bg-surface-800/60 border-b border-surface-700">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlignLeft className="w-3.5 h-3.5 text-accent-400" />
                      <span className="text-xs font-medium text-surface-300">What changed</span>
                    </div>
                    <p className="text-xs text-surface-400 leading-relaxed">{polishResult.explanation}</p>
                  </div>

                  {/* Polished content preview */}
                  <div className="px-3 py-2.5 bg-surface-900">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-success-400" />
                      <span className="text-xs font-medium text-surface-300">AI version</span>
                    </div>
                    <div
                      className="text-xs text-surface-400 leading-relaxed max-h-40 overflow-y-auto prose-sm"
                      dangerouslySetInnerHTML={{
                        __html: polishResult.polishedContent.slice(0, 500) + (polishResult.polishedContent.length > 500 ? '...' : '')
                      }}
                    />
                  </div>
                </div>

                {/* Accept / Reject */}
                <div className="flex gap-2">
                  <button
                    id="ai-reject-btn"
                    onClick={handleReject}
                    className="flex-1 py-2 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                  <button
                    id="ai-accept-btn"
                    onClick={handleAccept}
                    className="flex-1 py-2 bg-success-500 hover:bg-success-400 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Accept
                  </button>
                </div>
              </div>
            )}
          </>
        ) : activeTab === 'history' ? (
          <VersionHistory />
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header / Clear Session */}
            {brainstormMessages.length > 0 && (
              <div className="flex justify-end mb-2 shrink-0">
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-1.5 px-2 py-1 bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-surface-200 rounded text-xs transition-colors"
                  title="Clear Session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Session
                </button>
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto space-y-4 mb-3 pr-1">
              {brainstormMessages.length === 0 ? (
                <div className="text-center text-surface-500 text-xs mt-10">
                  Ask AI for ideas, plot points, or character concepts.
                </div>
              ) : (
                brainstormMessages.map((msg, idx) => (
                  <div key={idx} className={cn("p-2.5 rounded-lg text-sm whitespace-pre-wrap relative group", msg.role === 'user' ? "bg-accent-900/30 text-surface-200 ml-4" : "bg-surface-800 text-surface-300 mr-4")}>
                    {msg.content}
                    {msg.role === 'user' && (
                      <div className="absolute -bottom-3 right-2 hidden group-hover:flex items-center gap-1 bg-surface-800 border border-surface-700 rounded-md p-1 shadow-sm">
                        <button 
                          onClick={() => handleCopy(msg.content)} 
                          className="p-1 hover:bg-surface-700 rounded text-surface-400 hover:text-surface-200"
                          title="Copy"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => handleBrainstorm(msg.content)} 
                          className="p-1 hover:bg-surface-700 rounded text-surface-400 hover:text-surface-200"
                          title="Resend"
                          disabled={isBrainstorming}
                        >
                          <RefreshCcw className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
              {isBrainstorming && (
                <div className="p-2.5 rounded-lg text-sm bg-surface-800 text-surface-400 mr-4 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 mt-auto shrink-0">
              <textarea
                value={brainstormInput}
                onChange={(e) => setBrainstormInput(e.target.value)}
                placeholder="Ask something..."
                className="w-full bg-surface-800 border border-surface-700 rounded-lg p-2.5 text-sm text-surface-200 focus:outline-none focus:border-accent-500 resize-none h-20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleBrainstorm()
                  }
                }}
              />
              <button
                onClick={() => handleBrainstorm()}
                disabled={isBrainstorming || !brainstormInput.trim()}
                className="w-full py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear Session"
        size="sm"
      >
        <p className="text-sm text-surface-300 mb-6">
          Are you sure you want to clear the entire brainstorm session? This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowClearConfirm(false)}
            className="px-4 py-2 text-sm font-medium text-surface-300 hover:text-surface-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setBrainstormMessages([])
              setShowClearConfirm(false)
            }}
            className="px-4 py-2 text-sm font-medium bg-error-600 hover:bg-error-500 text-white rounded-md transition-colors"
          >
            Clear Session
          </button>
        </div>
      </Modal>
    </div>
  )
}
