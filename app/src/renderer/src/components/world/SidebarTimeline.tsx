import { useState, useMemo } from 'react'
import { Clock, RefreshCw, Calendar, Plus, Settings } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { aiService } from '../../services/aiService'
import { useToastStore } from '../../stores/toastStore'

export default function SidebarTimeline() {
  const { currentBook, chapters, timelineEvents, setTimelineEvents, addTimelineEvent, timelineSettings, setTimelineSettings, openTab } = useWorkspaceStore()
  const { user, settings } = useUserStore()
  const { addToast } = useToastStore()
  
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showFirstDayModal, setShowFirstDayModal] = useState(false)
  const [firstDayInput, setFirstDayInput] = useState('')

  const sortedEvents = useMemo(() => {
    return [...timelineEvents].sort((a, b) => b.story_day - a.story_day)
  }, [timelineEvents])

  const handleAnalyzeAll = async (overrideStartDate?: string) => {
    if (!user || !currentBook) return
    
    if (!settings?.ai_api_key) {
      addToast('Please set your AI API Key in Settings first.', 'error')
      return
    }

    setIsAnalyzing(true)
    
    try {
      const allText = chapters.map(c => c.content).join('\n\n')
      if (!allText.trim()) throw new Error('No chapter content to analyze.')

      const result = await aiService.analyzeTimelineEvents({
        content: allText,
        provider: settings.ai_provider as any,
        apiKey: settings?.ai_api_key, providerSettings: settings?.ai_settings,
        storyContext: currentBook.story_context || '',
        startDate: overrideStartDate || timelineSettings?.start_date_string
      })

      if (result.events && result.events.length > 0) {
        // Clear existing timeline events to prevent duplicates
        for (const existingEv of timelineEvents) {
          await window.api.timelineEvents.delete(existingEv.id)
        }
        setTimelineEvents([])

        for (const ev of result.events) {
          const newEvent = await window.api.timelineEvents.create({
            book_id: currentBook.id,
            title: ev.title,
            description: ev.description,
            story_day: ev.story_day,
            duration_days: ev.duration_days,
            characters_involved: ev.characters_involved
          })
          addTimelineEvent(newEvent as any)
        }
        addToast(`Discovered ${result.events.length} events!`, 'success')
      } else {
        addToast('No new timeline events found.', 'info')
      }
    } catch (err: any) {
      console.error(err)
      addToast(err.message || 'Failed to analyze timeline.', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAddManual = async () => {
    // Deprecated: No manual events. The user only wants chapter-by-chapter AI summaries.
  }

  const handleSaveFirstDay = async () => {
    if (!currentBook || !firstDayInput) return
    try {
      const updated = await window.api.timelineSettings.upsert({
        book_id: currentBook.id,
        start_date_string: firstDayInput,
        calendar_system: 'gregorian'
      })
      setTimelineSettings(updated as any)
      setShowFirstDayModal(false)
      addToast('First day set!', 'success')
      
      // Attempt to auto-analyze if API key is set
      if (settings?.ai_api_key) {
        // Run asynchronously so state has a moment to settle, though we use firstDayInput to be safe
        setTimeout(() => {
          handleAnalyzeAll(firstDayInput)
        }, 100)
      } else {
        addToast('Please set your AI API Key in Settings to generate the timeline.', 'info')
      }
    } catch (e) {
      console.error(e)
      addToast('Failed to set first day', 'error')
    }
  }

  const calculateDate = (storyDay: number) => {
    if (!timelineSettings?.start_date_string) return `Day ${storyDay}`
    try {
      const date = new Date(timelineSettings.start_date_string)
      date.setDate(date.getDate() + (storyDay - 1))
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch {
      return `Day ${storyDay}`
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-900 overflow-hidden">
      {/* Action Bar */}
      <div className="p-4 border-b border-surface-800 flex flex-col gap-3 shrink-0">
        <button
          onClick={() => {
            if (currentBook) {
              openTab(currentBook.id, 'timeline', 'Calendar')
            }
          }}
          className="w-full py-2 bg-surface-800 hover:bg-surface-700 text-surface-200 text-sm font-medium rounded-lg transition-colors border border-surface-700 hover:border-surface-600 flex items-center justify-center gap-2"
        >
          <Calendar className="w-4 h-4" />
          Open Calendar View
        </button>

        <button
          onClick={() => handleAnalyzeAll()}
          disabled={isAnalyzing}
          className="flex items-center justify-center gap-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white w-full py-1.5 rounded text-xs font-medium transition-colors"
        >
          {isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
          {isAnalyzing ? 'Analyzing...' : 'AI Analyze Timeline'}
        </button>
        
        <button
          onClick={() => setShowFirstDayModal(true)}
          className="flex w-full items-center justify-center gap-1.5 bg-surface-800 hover:bg-surface-700 text-surface-200 py-1.5 rounded text-xs font-medium transition-colors"
        >
          <Calendar className="w-3.5 h-3.5" />
          {timelineSettings?.start_date_string ? 'Change First Day' : 'Set First Day'}
        </button>
      </div>

      {/* Timeline List */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedEvents.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-8 h-8 text-surface-700 mx-auto mb-2" />
            <p className="text-surface-500 text-xs">No events tracked yet.</p>
          </div>
        ) : (
          <div className="relative border-l border-surface-800 ml-2 space-y-6">
            {sortedEvents.map((event) => (
              <div key={event.id} className="relative pl-4">
                <div className="absolute w-2.5 h-2.5 rounded-full bg-accent-600 ring-2 ring-surface-900 -left-[5px] top-1"></div>
                <div>
                  <div className="text-[10px] font-bold text-accent-500 uppercase tracking-wider mb-0.5">
                    {calculateDate(event.story_day)} (Day {event.story_day})
                  </div>
                  <div className="text-sm font-medium text-surface-200 leading-snug mb-1">
                    {event.title}
                  </div>
                  {event.description && (
                    <div className="text-xs text-surface-400 leading-relaxed italic">
                      {event.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showFirstDayModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-900 border border-surface-800 rounded-lg p-5 max-w-sm w-full">
            <h2 className="text-lg font-bold text-surface-100 mb-2">Set First Day</h2>
            <p className="text-xs text-surface-400 mb-4">Pick the real-world date for "Day 1".</p>
            <input 
              type="date" 
              value={firstDayInput}
              onChange={(e) => setFirstDayInput(e.target.value)}
              className="w-full bg-surface-950 border border-surface-700 rounded px-3 py-2 text-surface-100 text-sm mb-4 focus:outline-none focus:border-accent-500"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowFirstDayModal(false)}
                className="px-3 py-1.5 rounded text-xs text-surface-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveFirstDay}
                disabled={!firstDayInput}
                className="px-3 py-1.5 rounded bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
