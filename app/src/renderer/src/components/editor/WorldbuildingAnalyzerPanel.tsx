import { useState } from 'react'
import { Microscope, Loader2, Copy } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useToastStore } from '../../stores/toastStore'
import { aiService } from '../../services/aiService'
import { useStoryBibleStore } from '../../stores/storyBibleStore'

export default function WorldbuildingAnalyzerPanel({ chapterId }: { chapterId: string }) {
  const { 
    chapters, characters, locations, codex, wiki, organizations, worldRules, notes 
  } = useWorkspaceStore()
  const { settings } = useUserStore()
  const { addToast } = useToastStore()
  const { verseTimelineEvents } = useStoryBibleStore()

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<string | null>(null)

  const activeChapter = chapters.find(c => c.id === chapterId)

  const handleAnalyze = async () => {
    if (!activeChapter || !settings?.ai_api_key) {
      if (!settings?.ai_api_key) {
        addToast('Set your AI API key in Settings first', 'warning')
        return
      }
      addToast('Open a chapter to analyze', 'info')
      return
    }

    setIsAnalyzing(true)
    setAnalyzeResult(null)

    try {
      let storyContext = ''
      
      if (characters.length > 0) storyContext += 'CHARACTERS:\n' + characters.map(c => `- ${c.name} (Age: ${c.age}, Gender: ${c.gender}): ${c.appearance}. ${c.personality}. Goals: ${c.goals}`).join('\n') + '\n\n'
      if (locations.length > 0) storyContext += 'LOCATIONS:\n' + locations.map(l => `- ${l.name}: ${l.description}. Culture: ${l.culture}`).join('\n') + '\n\n'
      if (organizations.length > 0) storyContext += 'ORGANIZATIONS:\n' + organizations.map(o => `- ${o.name}: ${o.description}. Leader: ${o.leader}. Purpose: ${o.purpose}`).join('\n') + '\n\n'
      if (worldRules.length > 0) storyContext += 'WORLD RULES:\n' + worldRules.map(w => `- ${w.title}: ${w.description}`).join('\n') + '\n\n'
      if (codex.length > 0) storyContext += 'CODEX:\n' + codex.map(c => `- ${c.title}: ${c.description}`).join('\n') + '\n\n'
      if (wiki.length > 0) storyContext += 'WIKI:\n' + wiki.map(w => `- ${w.title}: ${w.content}`).join('\n') + '\n\n'
      if (notes.length > 0) storyContext += 'NOTES:\n' + notes.map(n => `- ${n.title}: ${n.content}`).join('\n') + '\n\n'
      if (verseTimelineEvents.length > 0) storyContext += 'TIMELINE:\n' + [...verseTimelineEvents].sort((a,b) => (a.sort_order||0)-(b.sort_order||0)).map(e => `- ${e.event_date ? `[${e.event_date}] ` : ''}${e.title}: ${e.description}`).join('\n') + '\n\n'

      const result = await aiService.analyzeWorldbuilding({
        content: activeChapter.content.replace(/<[^>]*>/g, ''),
        provider: settings.ai_provider || 'openai',
        apiKey: settings.ai_api_key,
        storyContext: storyContext.trim()
      })

      setAnalyzeResult(result)
      addToast('Analysis complete!', 'success')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed'
      addToast(msg, 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    addToast('Copied to clipboard', 'success')
  }

  return (
    <div className="flex flex-col h-full bg-surface-900 w-80 border-l border-surface-800" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-800 shrink-0 h-9">
        <div className="flex items-center gap-2">
          <Microscope className="w-3.5 h-3.5 text-accent-500" />
          <span className="text-xs font-semibold text-surface-200">Worldbuilding Analyzer</span>
        </div>
      </div>

      <div className="flex flex-col h-full overflow-hidden p-3">
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {analyzeResult ? (
            <div className="bg-surface-800 p-3 rounded-lg">
              <div className="flex justify-end mb-2">
                <button 
                  onClick={() => handleCopy(analyzeResult)} 
                  className="p-1 hover:bg-surface-700 rounded text-surface-400 hover:text-surface-200"
                  title="Copy Analysis"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-xs text-surface-300 leading-relaxed whitespace-pre-wrap">
                {analyzeResult}
              </div>
            </div>
          ) : (
            <div className="text-center text-surface-500 text-xs mt-10">
              Run the Worldbuilding Analyzer to check your chapter against your Story Bible, Lore, and Organizations.
            </div>
          )}
          {isAnalyzing && (
            <div className="p-3 rounded-lg text-sm bg-surface-800 text-surface-400 flex flex-col items-center justify-center gap-2 mt-4">
              <Loader2 className="w-5 h-5 animate-spin text-accent-500" />
              <span className="text-xs">Analyzing Worldbuilding...</span>
            </div>
          )}
        </div>
        <div className="mt-auto shrink-0 pt-3">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !activeChapter}
            className="w-full py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Microscope className="w-4 h-4" />
                Analyze Chapter vs Lore
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
