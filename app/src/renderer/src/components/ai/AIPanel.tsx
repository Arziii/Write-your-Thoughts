import { useEffect, useState } from 'react'
import {
  Sparkles, CheckCheck, X, Loader2, History, ChevronDown,
  RotateCcw, Zap, AlignLeft, Maximize2, PanelRight, Copy, Trash2
} from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useToastStore } from '../../stores/toastStore'
import { aiService } from '../../services/aiService'
import { getAIConfigurationError, isLocalAIProvider } from '../../services/ai/configuration'
import type { AIPolishResult, ChapterVersion, AIMode, AIBrainstormMessage } from '../../types'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { cn, formatDate } from '../../utils'
import VersionHistory from './VersionHistory'
import Modal from '../ui/Modal'
import MessageActions from './MessageActions'

const modeDescriptions: Record<AIMode, string> = {
  grammar: 'Fix grammar & punctuation only',
  balanced: 'Improve flow & clarity',
  strong: 'Significantly enhance readability',
  expand: 'Add descriptive details and length',
  shorten: 'Condense and make punchy',
  describe: 'Enhance sensory details',
  custom: 'Follow custom instruction',
}

type ChatMode = 'manuscript' | 'ideas'
type AssistantMessage = AIBrainstormMessage & { id: string; createdAt: number }

function createMessage(role: AssistantMessage['role'], content: string): AssistantMessage {
  return { role, content, id: crypto.randomUUID(), createdAt: Date.now() }
}

export default function AIPanel() {
  const { activeChapter, currentBook, tabs, activeTabId, updateChapter, characters, locations, timelineEvents, toggleAIPanel, panelState, selectedText } = useWorkspaceStore()
  const { settings, user } = useUserStore()
  const { addToast } = useToastStore()
  const { verseTimelineEvents } = useStoryBibleStore()

  const [isPolishing, setIsPolishing] = useState(false)
  const [polishResult, setPolishResult] = useState<AIPolishResult | null>(null)
  const [mode, setMode] = useState<AIMode>('grammar')
  const [customInstruction, setCustomInstruction] = useState('')
  const [activeTabPanel, setActiveTabPanel] = useState<'polish' | 'history' | 'brainstorm'>('polish')
  const [showModeMenu, setShowModeMenu] = useState(false)

  // Brainstorm state
  const [chatMode, setChatMode] = useState<ChatMode>('manuscript')
  const [chatThreads, setChatThreads] = useState<Record<string, AssistantMessage[]>>({})
  const [brainstormInput, setBrainstormInput] = useState('')
  const [edit, setEdit] = useState<{ id: string; text: string } | null>(null)
  const [isBrainstorming, setIsBrainstorming] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    const onOpenPolish = () => setActiveTabPanel('polish')
    window.addEventListener('open-ai-polish', onOpenPolish)
    return () => window.removeEventListener('open-ai-polish', onOpenPolish)
  }, [])

  const activeTab = tabs.find(t => t.id === activeTabId)
  const chapter = activeTab?.type === 'chapter' && activeChapter?.id === activeTab.entityId ? activeChapter : null
  const chatKey = chatMode === 'manuscript' ? `chapter:${chapter?.id ?? ''}` : `ideas:${currentBook?.id ?? ''}`
  const brainstormMessages = chatThreads[chatKey] ?? []

  function setBrainstormMessages(messages: AssistantMessage[]) {
    setChatThreads(threads => ({ ...threads, [chatKey]: messages }))
  }

  const handlePolish = async () => {
    const textToPolish = selectedText?.trim() || activeChapter?.content;

    const configurationError = getAIConfigurationError(settings)
    if (!settings || configurationError) {
      addToast(configurationError ?? 'Open Settings to configure an AI provider.', 'warning')
      return
    }
    if (!textToPolish) {
      addToast('Select some text or open a chapter to polish', 'info')
      return
    }

    setIsPolishing(true)
    setPolishResult(null)

    try {
      // Build story context by finding matching entities
      const contextText = activeChapter ? activeChapter.content.replace(/<[^>]*>/g, '') : textToPolish;
      let storyContext = ''

      // Include auto-matched and locked entities
      const lockedIds = panelState.lockedEntities || []
      const matchedCharacters = characters.filter(c => lockedIds.includes(c.id) || contextText.includes(c.name) || (c.nickname && contextText.includes(c.nickname)))
      if (matchedCharacters.length > 0) {
        storyContext += 'CHARACTERS:\n' + matchedCharacters.map(c => `- ${c.name} (Age: ${c.age}, Gender: ${c.gender}): ${c.appearance}. ${c.personality}. Goals: ${c.goals}`).join('\n') + '\n\n'
      }

      const matchedLocations = locations.filter(l => lockedIds.includes(l.id) || contextText.includes(l.name))
      if (matchedLocations.length > 0) {
        storyContext += 'LOCATIONS:\n' + matchedLocations.map(l => `- ${l.name}: ${l.description}. Culture: ${l.culture}`).join('\n') + '\n\n'
      }

      if (verseTimelineEvents.length > 0) {
        storyContext += 'VERSE TIMELINE RECORD (Global World Events):\n' + [...verseTimelineEvents].sort((a,b) => (a.sort_order||0)-(b.sort_order||0)).map(e => `- ${e.event_date ? `[${e.event_date}] ` : ''}${e.title}: ${e.description}`).join('\n') + '\n\n'
      }

      // Save version before polishing ONLY if it's a full chapter polish
      if (user && activeChapter && !selectedText?.trim()) {
        await window.api.chapters.saveVersion({
          chapterId: activeChapter.id,
          userId: user.id,
          content: activeChapter.content,
          wordCount: activeChapter.word_count || 0,
          snapshotType: 'auto',
          milestoneName: 'Pre-AI Polish'
        })
      }

      const result = await aiService.polishText({
        content: textToPolish,
        provider: settings.ai_provider || 'openai',
        apiKey: settings?.ai_api_key, providerSettings: settings?.ai_settings,
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
    if (!polishResult || !user) return
    
    if (activeChapter && !selectedText?.trim()) {
      try {
        const wc = polishResult.polishedContent.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length
        // Save AI output as new version
        await window.api.chapters.saveVersion({
          chapterId: activeChapter.id,
          userId: user.id,
          content: polishResult.polishedContent,
          wordCount: wc,
          snapshotType: 'auto',
          milestoneName: 'AI Polish Result'
        })
        // Save to chapter
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
    } else {
      // It's a selection polish, dispatch event to replace it
      window.dispatchEvent(new CustomEvent('replace-textarea-selection', { detail: { text: polishResult.polishedContent } }))
      
      // Also copy to clipboard as a fallback
      navigator.clipboard.writeText(polishResult.polishedContent.replace(/<[^>]*>/g, ''))
      
      setPolishResult(null)
      addToast('AI edits applied (or copied to clipboard)', 'success')
    }
  }

  const handleReject = () => {
    setPolishResult(null)
    addToast('AI edits rejected', 'info')
  }

  const handleBrainstorm = async (overrideInput?: string) => {
    const inputToUse = (overrideInput ?? brainstormInput).trim()
    if (isBrainstorming || !inputToUse) return
    if (chatMode === 'manuscript' && !chapter) {
      addToast('Open a chapter to ask about its text.', 'info')
      return
    }
    const configurationError = getAIConfigurationError(settings)
    if (!settings || configurationError) {
      addToast(configurationError ?? 'Open Settings to configure an AI provider.', 'warning')
      return
    }

    const currentEdit = edit
    const newMessages = [...brainstormMessages, createMessage('user', inputToUse)]
    setBrainstormMessages(newMessages)
    if (overrideInput === undefined) setBrainstormInput('')
    setEdit(null)
    setIsBrainstorming(true)

    try {
      const provider = settings.ai_provider || 'openai'
      if (chatMode === 'manuscript' && chapter) {
        const draft = useWorkspaceStore.getState().drafts[chapter.id]?.content
        const response = await aiService.askManuscript({
          question: inputToUse,
          chapterTitle: chapter.title,
          chapterContent: typeof draft === 'string' ? draft : chapter.content,
          selection: selectedText,
          provider,
          apiKey: settings.ai_api_key,
          providerSettings: settings.ai_settings,
        })
        setBrainstormMessages([...newMessages, createMessage('assistant', response)])
        return
      }
      const local = isLocalAIProvider(provider, settings.ai_settings?.[provider]?.baseUrl)
      let storyContext = ''
      
      if (currentBook) {
        storyContext += `Current Book: ${currentBook.title}\n`
      }

      if (activeTab) {
        const docType = activeTab.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        storyContext += `Current Editor: ${activeTab.type === 'chapter' ? 'Story Editor' : 'Worldbuilding Editor'}\n`
        storyContext += `Current Document: ${activeTab.title}\n`
        storyContext += `Document Type: ${docType}\n`
      }
      
      if (selectedText && selectedText.trim().length > 0) {
        const selection = selectedText.trim()
        if (local && selection.length > 3600) {
          throw new Error('Select a shorter passage for local Brainstorm chat.')
        }
        storyContext += `Selected Text: "${selection}"\n`
      }
      
      const lockedIds = panelState.lockedEntities || []
      let relatedDocsAdded = false
      
      const matchedCharacters = characters.filter(c => lockedIds.includes(c.id))
      if (matchedCharacters.length > 0) {
        if (!relatedDocsAdded) { storyContext += '\nRelated Documents:\n'; relatedDocsAdded = true }
        storyContext += '• Characters:\n' + matchedCharacters.map(c => `  - ${c.name} (Age: ${c.age}, Gender: ${c.gender}): ${c.appearance}. ${c.personality}. Goals: ${c.goals}`).join('\n') + '\n'
      }

      const matchedLocations = locations.filter(l => lockedIds.includes(l.id))
      if (matchedLocations.length > 0) {
        if (!relatedDocsAdded) { storyContext += '\nRelated Documents:\n'; relatedDocsAdded = true }
        storyContext += '• Locations:\n' + matchedLocations.map(l => `  - ${l.name}: ${l.description}. Culture: ${l.culture}`).join('\n') + '\n'
      }

      if (verseTimelineEvents.length > 0) {
        const events = [...verseTimelineEvents].sort((a,b) => (a.sort_order||0)-(b.sort_order||0))
        const terms = local ? inputToUse.toLowerCase().match(/[\p{L}\p{N}]{5,}/gu) ?? [] : []
        const matchingEvents = local
          ? events.filter(event => {
              const text = `${event.title} ${event.description}`.toLowerCase()
              return terms.some(term => text.includes(term))
            }).slice(0, 4)
          : events
        if (matchingEvents.length) {
          if (!relatedDocsAdded) storyContext += '\nRelated Documents:\n'
          storyContext += '• Global World Events:\n' + matchingEvents.map(e => `  - ${e.event_date ? `[${e.event_date}] ` : ''}${e.title}: ${local ? e.description?.slice(0, 240) ?? '' : e.description}`).join('\n') + '\n'
        }
      }

      const recentMessages = newMessages.slice(-20).map(({ role, content }) => ({ role, content }))

      const response = await aiService.brainstorm({
        messages: recentMessages,
        provider,
        apiKey: settings?.ai_api_key, providerSettings: settings?.ai_settings,
        storyContext: storyContext.trim(),
      })

      setBrainstormMessages([...newMessages, createMessage('assistant', response)])
    } catch (err: unknown) {
      setBrainstormMessages(brainstormMessages)
      if (overrideInput === undefined) setBrainstormInput(inputToUse)
      setEdit(currentEdit)
      const msg = err instanceof Error ? err.message : 'Brainstorming failed'
      addToast(msg, 'error')
    } finally {
      setIsBrainstorming(false)
    }
  }

  function saveMessageEdit(message: AssistantMessage, text: string) {
    const content = text.trim()
    if (!content || content === message.content || isBrainstorming) return
    if (message.role === 'user') {
      void handleBrainstorm(content)
      return
    }
    setBrainstormMessages(brainstormMessages.map(item => item.id === message.id ? { ...item, content } : item))
    setEdit(null)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    addToast('Copied to clipboard', 'success')
  }

  return (
    <div id="ai-panel" className="flex flex-col h-full w-full bg-[hsl(var(--studio-desk))]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-header))] h-10 shrink-0">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[hsl(var(--brand-green))]" />
          <span className="text-xs font-semibold text-surface-100">AI Assistant</span>
        </div>
        <button
          onClick={toggleAIPanel}
          className="rounded-md p-1 text-surface-400 hover:bg-surface-850 hover:text-surface-100 transition-colors"
          title="Collapse AI Assistant"
          aria-label="Collapse AI Assistant"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-header))] shrink-0">
        {[
          { id: 'polish', label: 'Polish', icon: Zap },
          { id: 'brainstorm', label: 'Brainstorm', icon: Sparkles },
          { id: 'history', label: 'History', icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`ai-tab-${id}`}
            onClick={() => setActiveTabPanel(id as 'polish' | 'history' | 'brainstorm')}
            className={cn(
              'flex items-center justify-center gap-1.5 flex-1 py-2 text-xs font-medium transition-colors',
              activeTabPanel === id
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
        {activeTabPanel === 'polish' ? (
          <>
            {/* Context info */}
            {activeTab ? (
              <div className="glass-card rounded-lg p-3">
                <p className="text-xs text-surface-400 mb-0.5">Editing</p>
                <p className="text-sm text-surface-200 font-medium truncate">{activeTab.title}</p>
                {activeChapter && <p className="text-xs text-surface-500 mt-0.5">{activeChapter.word_count} words</p>}
                {selectedText && (
                  <div className="mt-2 text-[10px] bg-accent-500/10 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 px-1.5 py-1 rounded border border-accent-500/20 truncate">
                    Targeting Selection ({selectedText.trim().split(/\s+/).filter(Boolean).length} words)
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card rounded-lg p-3 text-center">
                <p className="text-xs text-surface-500">Open a document to use AI features.</p>
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
              disabled={isPolishing || (!activeChapter && !selectedText?.trim())}
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

            {/* AI Result */}
            {polishResult && (
              <div className="selectable space-y-3 animate-fade-in">
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
        ) : activeTabPanel === 'history' ? (
          <VersionHistory />
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div aria-label="Chat mode" role="group" className="mb-2 grid shrink-0 grid-cols-2 gap-1 rounded-lg border border-surface-700 p-1">
              {(['manuscript', 'ideas'] as const).map(mode => (
                <button
                  key={mode}
                  type="button"
                  disabled={isBrainstorming}
                  aria-pressed={chatMode === mode}
                  onClick={() => {
                    setChatMode(mode)
                    setEdit(null)
                  }}
                  className={cn('rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    chatMode === mode
                      ? 'bg-[hsl(var(--brand-green-bg))] font-semibold text-[hsl(var(--brand-green))]'
                      : 'text-surface-400 hover:bg-surface-800')}
                >
                  {mode === 'manuscript' ? 'Ask Manuscript' : 'Brainstorm Ideas'}
                </button>
              ))}
            </div>
            {/* Header / Clear Session */}
            {brainstormMessages.length > 0 && (
              <div className="flex justify-end mb-2 shrink-0">
                <button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={isBrainstorming}
                  className="flex items-center gap-1.5 px-2 py-1 bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-surface-200 rounded text-xs transition-colors disabled:opacity-50"
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
                  {chatMode === 'ideas'
                    ? 'Explore ideas, alternate scenes, or new characters.'
                    : chapter ? 'Ask what’s on the page. Answers quote your current chapter.'
                      : 'Open a chapter to ask about its text.'}
                </div>
              ) : (
                brainstormMessages.map(msg => (
                  <article key={msg.id} aria-label={msg.role === 'user' ? 'Your message' : 'AI reply'}
                    className={cn('selectable min-w-0 text-sm', msg.role === 'user' ? 'ml-4' : 'mr-4')}>
                    <div className={cn('rounded-lg p-2.5', msg.role === 'user' ? 'bg-accent-900/30 text-surface-200' : 'bg-surface-800 text-surface-300')}>
                      {msg.role === 'assistant' && chatMode === 'ideas' && <p className="mb-1 text-xs font-medium text-surface-400">Brainstorm suggestion</p>}
                      {edit?.id === msg.id ? (
                        <>
                          <textarea autoFocus aria-label="Edit message" value={edit.text}
                            onChange={event => setEdit({ id: msg.id, text: event.target.value })}
                            className="block min-h-20 w-full resize-y rounded-md border border-surface-700 bg-surface-950 p-2 text-sm text-surface-100 focus-visible:outline-accent-700"
                          />
                          <div className="mt-2 flex flex-wrap justify-end gap-1">
                            <button type="button" onClick={() => setEdit(null)} className="rounded-md px-2 py-1 text-xs hover:bg-surface-850">Cancel</button>
                            <button type="button" onClick={() => saveMessageEdit(msg, edit.text)}
                              disabled={isBrainstorming || !edit.text.trim() || edit.text.trim() === msg.content}
                              className="rounded-md bg-[hsl(var(--brand-green-bg))] px-2 py-1 text-xs font-medium text-[hsl(var(--brand-green))] disabled:opacity-50">
                              {msg.role === 'user' ? 'Send revision' : 'Save edit'}
                            </button>
                          </div>
                        </>
                      ) : <p className="select-text whitespace-pre-wrap break-words">{msg.content}</p>}
                    </div>
                    {edit?.id !== msg.id && (
                      <MessageActions
                        content={msg.content}
                        createdAt={msg.createdAt}
                        alignRight={msg.role === 'user'}
                        disabled={isBrainstorming}
                        onEdit={() => setEdit({ id: msg.id, text: msg.content })}
                        onResend={msg.role === 'user' ? () => void handleBrainstorm(msg.content) : undefined}
                        onCopyError={() => addToast('Could not copy. Select the text to copy it manually.', 'error')}
                      />
                    )}
                  </article>
                ))
              )}
              {isBrainstorming && (
                <div className="p-2.5 rounded-lg text-sm bg-surface-800 text-surface-400 mr-4 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 mt-auto shrink-0">
              {selectedText && selectedText.trim().length > 0 && (() => {
                const words = selectedText.trim().split(/\s+/)
                const wordCount = words.length
                let displaySnippet = selectedText.trim()
                if (wordCount > 30) {
                  displaySnippet = words.slice(0, 15).join(' ') + ' ... ' + words.slice(-10).join(' ')
                }
                return (
                  <div className="px-2.5 py-2 bg-surface-800 border border-surface-700 border-l-2 border-l-accent-500 rounded-lg text-xs shadow-sm flex flex-col gap-1">
                    <div className="flex justify-between items-center text-surface-400 font-medium">
                      <span>Targeting Selection</span>
                      <span className="text-[10px] bg-surface-700 px-1.5 py-0.5 rounded">{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
                    </div>
                    <span className="text-surface-200 italic line-clamp-4">"{displaySnippet}"</span>
                  </div>
                )
              })()}
              <textarea
                value={brainstormInput}
                onChange={(e) => setBrainstormInput(e.target.value)}
                placeholder={chatMode === 'manuscript' ? 'Ask about this chapter…' : 'Ask for ideas…'}
                disabled={isBrainstorming}
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
        <p className="text-sm text-surface-300 mb-6">Clear the messages in this chat?</p>
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
              setEdit(null)
              setShowClearConfirm(false)
            }}
            className="px-4 py-2 text-sm font-medium bg-danger-500 hover:bg-danger-400 text-white rounded-md transition-colors"
          >
            Clear Session
          </button>
        </div>
      </Modal>
    </div>
  )
}
