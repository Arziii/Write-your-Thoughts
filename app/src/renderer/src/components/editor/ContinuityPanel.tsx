import { useState, useEffect } from 'react'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { Plus, Trash2, Shield, AlertTriangle, CheckCircle, RefreshCw, Sparkles } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { aiService } from '../../services/aiService'

export default function ContinuityPanel({ chapterId }: { chapterId: string }) {
  const { 
    continuityEvents, setContinuityEvents, addContinuityEvent, removeContinuityEvent,
    continuityWarnings, setContinuityWarnings, addContinuityWarning, resolveContinuityWarning, removeContinuityWarning,
    storyBible, verseTimelineEvents
  } = useStoryBibleStore()
  
  const { chapters } = useWorkspaceStore()
  const { settings } = useUserStore()
  const { addToast } = useToastStore()

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [newEventDesc, setNewEventDesc] = useState('')
  const [newWarningDesc, setNewWarningDesc] = useState('')

  useEffect(() => {
    const loadData = async () => {
      try {
        const events = await window.api.continuityEvents.getByChapter(chapterId)
        setContinuityEvents(chapterId, events)

        const warnings = await window.api.continuityWarnings.getByChapter(chapterId)
        setContinuityWarnings(chapterId, warnings)
      } catch (e) {
        console.error('Failed to load continuity data', e)
      }
    }
    loadData()
  }, [chapterId])

  const activeChapter = chapters.find(c => c.id === chapterId)

  const handleAnalyzeContinuity = async () => {
    if (!settings?.ai_api_key) {
      addToast('Please set your AI API Key in Settings first', 'error')
      return
    }
    if (!activeChapter?.content) {
      addToast('Chapter is empty.', 'error')
      return
    }

    setIsAnalyzing(true)
    try {
      let contextStr = storyBible?.premise || 'No context'
      if (verseTimelineEvents.length > 0) {
        contextStr += '\n\nVERSE TIMELINE RECORD (Global World Events):\n' + [...verseTimelineEvents].sort((a,b) => (a.sort_order||0)-(b.sort_order||0)).map(e => `- ${e.event_date ? `[${e.event_date}] ` : ''}${e.title}: ${e.description}`).join('\n')
      }

      const result = await aiService.analyzeContinuity({
        content: activeChapter.content,
        storyContext: contextStr,
        provider: settings.ai_provider as any,
        apiKey: settings.ai_api_key
      })

      // Guard against empty fallback data
      if (result.events.length === 0 && result.warnings.length === 0) {
        addToast('AI found no events or warnings, or the request failed. Try again.', 'info')
        return
      }

      // Create events
      for (const ev of result.events) {
        const added = await window.api.continuityEvents.create({
          chapter_id: chapterId,
          description: ev.description,
          event_type: ev.event_type
        })
        addContinuityEvent(added)
      }

      // Create warnings
      for (const warn of result.warnings) {
        const added = await window.api.continuityWarnings.create({
          chapter_id: chapterId,
          warning_description: warn.warning_description,
          severity: warn.severity
        })
        addContinuityWarning(added)
      }

      addToast('Continuity analysis complete!', 'success')
    } catch (e: any) {
      console.error(e)
      addToast(e.message || 'AI Analysis failed.', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAddEvent = async () => {
    if (!newEventDesc.trim()) return
    try {
      const added = await window.api.continuityEvents.create({
        chapter_id: chapterId,
        description: newEventDesc,
        event_type: 'General'
      })
      addContinuityEvent(added)
      setNewEventDesc('')
    } catch {
      addToast('Failed to add event', 'error')
    }
  }

  const handleDeleteEvent = async (id: string) => {
    try {
      await window.api.continuityEvents.delete(id)
      removeContinuityEvent(chapterId, id)
    } catch {
      addToast('Failed to delete event', 'error')
    }
  }

  const handleAddWarning = async () => {
    if (!newWarningDesc.trim()) return
    try {
      const added = await window.api.continuityWarnings.create({
        chapter_id: chapterId,
        warning_description: newWarningDesc,
        severity: 'Medium'
      })
      addContinuityWarning(added)
      setNewWarningDesc('')
    } catch {
      addToast('Failed to add warning', 'error')
    }
  }

  const handleResolveWarning = async (id: string) => {
    try {
      await window.api.continuityWarnings.resolve(id)
      resolveContinuityWarning(chapterId, id)
      addToast('Warning resolved', 'success')
    } catch {
      addToast('Failed to resolve warning', 'error')
    }
  }

  const handleDeleteWarning = async (id: string) => {
    try {
      await window.api.continuityWarnings.delete(id)
      removeContinuityWarning(chapterId, id)
    } catch {
      addToast('Failed to delete warning', 'error')
    }
  }

  const eventsList = continuityEvents[chapterId] || []
  const warningsList = continuityWarnings[chapterId] || []

  return (
    <div className="flex flex-col h-full bg-surface-900 border-l border-surface-800 animate-in slide-in-from-right-8 duration-200" style={{ width: '340px' }}>
      <div className="p-4 border-b border-surface-800 flex items-center justify-between text-surface-100">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent-400" />
          <h3 className="font-semibold text-sm">Continuity Engine</h3>
        </div>
        <button 
          onClick={handleAnalyzeContinuity}
          disabled={isAnalyzing}
          className="bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
        >
          {isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          AI Analyze
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        
        {/* Warnings */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Continuity Warnings
          </h4>
          
          <div className="flex gap-2 mb-2">
            <input 
              value={newWarningDesc}
              onChange={e => setNewWarningDesc(e.target.value)}
              placeholder="Add manual warning..."
              className="flex-1 bg-surface-800 border border-surface-700 rounded p-2 text-sm text-surface-200 focus:outline-none focus:border-red-500"
              onKeyDown={e => e.key === 'Enter' && handleAddWarning()}
            />
            <button onClick={handleAddWarning} className="bg-surface-700 hover:bg-surface-600 text-surface-200 rounded px-3 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {warningsList.map(warning => (
              <div key={warning.id} className={`border rounded p-3 group relative transition-colors ${warning.resolved ? 'bg-surface-900/50 border-surface-800 opacity-60' : 'bg-red-950/30 border-red-900/50'}`}>
                <div className="pr-12">
                  <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium mr-2 ${warning.severity === 'Critical' ? 'bg-red-900/80 text-red-200' : 'bg-orange-900/80 text-orange-200'}`}>
                    {warning.severity}
                  </span>
                  <span className={`text-sm ${warning.resolved ? 'text-surface-500 line-through' : 'text-surface-200'}`}>
                    {warning.warning_description}
                  </span>
                </div>
                
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!warning.resolved && (
                    <button onClick={() => handleResolveWarning(warning.id)} title="Resolve" className="p-1.5 text-surface-400 hover:text-green-400 bg-surface-800 rounded">
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => handleDeleteWarning(warning.id)} title="Delete" className="p-1.5 text-surface-400 hover:text-red-400 bg-surface-800 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {warningsList.length === 0 && (
              <p className="text-xs text-surface-500 text-center py-4 bg-surface-800/50 rounded border border-dashed border-surface-700">No warnings detected.</p>
            )}
          </div>
        </div>

        {/* Events */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Canon Events</h4>
          
          <div className="flex gap-2 mb-2">
            <input 
              value={newEventDesc}
              onChange={e => setNewEventDesc(e.target.value)}
              placeholder="Add canon event..."
              className="flex-1 bg-surface-800 border border-surface-700 rounded p-2 text-sm text-surface-200 focus:outline-none focus:border-accent-500"
              onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
            />
            <button onClick={handleAddEvent} className="bg-surface-700 hover:bg-surface-600 text-surface-200 rounded px-3 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {eventsList.map(event => (
              <div key={event.id} className="bg-surface-800 border border-surface-700 rounded p-3 group relative">
                <span className="text-xs px-1.5 py-0.5 bg-surface-700 text-surface-300 rounded-sm font-medium mr-2">
                  {event.event_type}
                </span>
                <span className="text-sm text-surface-200">{event.description}</span>
                
                <button 
                  onClick={() => handleDeleteEvent(event.id)}
                  className="absolute top-3 right-3 text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {eventsList.length === 0 && (
              <p className="text-xs text-surface-500 text-center py-4 bg-surface-800/50 rounded border border-dashed border-surface-700">No events logged.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
