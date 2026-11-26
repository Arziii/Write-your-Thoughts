import { useState } from 'react'
import { Microscope, Copy } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useToastStore } from '../../stores/toastStore'
import { aiService } from '../../services/aiService'
import { getAIConfigurationError } from '../../services/ai/configuration'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { cn } from '../../utils'
import { EditorToolPanel, PanelAnalyzeButton, PanelEmptyState, panelButton, panelCard } from './EditorToolPanel'

export default function WorldbuildingAnalyzerPanel({ chapterId, onClose }: { chapterId: string; onClose: () => void }) {
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
    const configurationError = getAIConfigurationError(settings)
    if (!settings || configurationError) {
      addToast(configurationError ?? 'Open Settings to configure an AI provider.', 'warning')
      return
    }
    if (!activeChapter) {
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
        apiKey: settings?.ai_api_key, providerSettings: settings?.ai_settings,
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

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      addToast('Copied to clipboard', 'success')
    } catch {
      addToast('Could not copy the analysis', 'error')
    }
  }

  return (
    <EditorToolPanel id="worldbuilding-panel" title="Worldbuilding Analyzer" icon={Microscope} onClose={onClose}
      action={<PanelAnalyzeButton label="Analyze chapter vs. lore" busy={isAnalyzing}
        disabled={!activeChapter} onClick={() => void handleAnalyze()} />}>
      {isAnalyzing ? (
        <p role="status" className={cn(panelCard, 'text-sm text-surface-400')}>Checking this chapter against your worldbuilding records…</p>
      ) : analyzeResult ? (
        <section className={panelCard} aria-label="Analysis report">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">Analysis report</h4>
            <button type="button" onClick={() => void handleCopy(analyzeResult)} className={panelButton}>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy report
            </button>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-surface-200">{analyzeResult}</p>
        </section>
      ) : (
        <PanelEmptyState icon={Microscope} title="No analysis yet"
          description="Check this chapter against your characters, locations, rules, and other lore." />
      )}
    </EditorToolPanel>
  )
}
