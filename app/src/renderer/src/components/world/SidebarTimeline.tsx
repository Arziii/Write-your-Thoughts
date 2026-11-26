import { useState, useMemo } from 'react'
import { useOpenBookTab } from '../../hooks/useOpenBookTab'
import { Clock, RefreshCw, Calendar } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { analyzeTimeline, makeTimelineInput, timelineInputKey } from '../../services/timelineAnalysis'
import { getAIConfigurationError } from '../../services/ai/configuration'
import { useToastStore } from '../../stores/toastStore'
import type { TimelineEvent } from '../../types'

const analyzingBooks = new Set<string>()

export default function SidebarTimeline() {
  const { currentBook, timelineEvents, setTimelineEvents, timelineSettings, setTimelineSettings } = useWorkspaceStore()
  const openBookTab = useOpenBookTab()
  const { addToast } = useToastStore()
  
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<{ bookId: string; message: string }>()
  const [showFirstDayModal, setShowFirstDayModal] = useState(false)
  const [firstDayInput, setFirstDayInput] = useState('')

  const sortedEvents = useMemo(() => {
    return [...timelineEvents].sort((a, b) => b.story_day - a.story_day)
  }, [timelineEvents])

  const handleAnalyzeAll = async () => {
    const { user, settings } = useUserStore.getState()
    const workspace = useWorkspaceStore.getState()
    const book = workspace.currentBook
    if (!user || !book || analyzingBooks.has(book.id)) return
    const isCurrentBook = () => useWorkspaceStore.getState().currentBook?.id === book.id && useUserStore.getState().user?.id === user.id
    analyzingBooks.add(book.id)
    setIsAnalyzing(true)
    setAnalysisError(undefined)
    try {
      const input = makeTimelineInput(book.id, workspace.chapters, workspace.drafts, book.story_context || '')
      if (!input.chapters.length) throw new Error('No chapter content to analyze.')
      const inputKey = await timelineInputKey(input)
      const cached: TimelineEvent[] | null = await window.api.timelineEvents.getAnalysis(book.id, inputKey)
      if (!isCurrentBook()) return
      if (cached !== null) {
        setTimelineEvents(cached)
        addToast('Manuscript unchanged. Showing the saved timeline.', 'info')
        return
      }

      const configurationError = getAIConfigurationError(settings)
      if (!settings || configurationError) {
        throw new Error(configurationError ?? 'Open Settings to configure an AI provider.')
      }

      const events = await analyzeTimeline(input, settings)
      if (!isCurrentBook()) return
      const latest = useWorkspaceStore.getState()
      const latestInput = makeTimelineInput(book.id, latest.chapters, latest.drafts, latest.currentBook?.story_context || '')
      if (JSON.stringify(input) !== JSON.stringify(latestInput)) {
        addToast('The manuscript changed during analysis. Run it again to use the latest text.', 'info')
        return
      }
      if (!events.length) {
        addToast('No on-page timeline events were found.', 'info')
        return
      }

      const saved: TimelineEvent[] = await window.api.timelineEvents.saveAnalysis(book.id, inputKey, events)
      if (isCurrentBook()) {
        setTimelineEvents(saved)
        addToast('Timeline updated with ' + saved.length + (saved.length === 1 ? ' entry.' : ' entries.'), 'success')
      }
    } catch (error) {
      if (isCurrentBook()) {
        const message = (error instanceof Error ? error.message : 'Failed to analyze timeline.')
          .replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
        setAnalysisError({ bookId: book.id, message })
        addToast(message, 'error')
      }
    } finally {
      analyzingBooks.delete(book.id)
      setIsAnalyzing(false)
    }
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
              openBookTab(`calendar-${currentBook.id}`, 'timeline', 'Calendar')
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

      {analysisError?.bookId === currentBook?.id && analysisError && (
        <p role="alert" className="px-4 pt-3 text-xs text-warning-400">{analysisError.message}{timelineEvents.length > 0 && ' Showing the last saved timeline.'}</p>
      )}

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
