import { useState, useEffect } from 'react'
import { Feather, AlertTriangle } from 'lucide-react'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useToastStore } from '../../stores/toastStore'
import { aiService } from '../../services/aiService'
import { getAIConfigurationError } from '../../services/ai/configuration'
import { cn } from '../../utils'
import { EditorToolPanel, PanelAnalyzeButton, PanelEmptyState, panelCard } from './EditorToolPanel'

const styleMetrics = [
  ['sentence_length', 'Sentence length'], ['dialogue_ratio', 'Dialogue ratio'], ['vocabulary', 'Vocabulary'],
  ['tone', 'Tone'], ['prose_density', 'Prose density'],
] as const

export default function StyleIntelligencePanel({ chapterId, onClose }: { chapterId: string; onClose: () => void }) {
  const { 
    styleProfiles, setStyleProfiles, updateStyleProfile,
    chapterMetrics, setChapterMetrics, updateChapterMetric,
    storyBible
  } = useStoryBibleStore()
  
  const { currentBook, chapters } = useWorkspaceStore()
  const { settings } = useUserStore()
  const { addToast } = useToastStore()

  const [isAnalyzingBaseline, setIsAnalyzingBaseline] = useState(false)
  const [isAnalyzingChapter, setIsAnalyzingChapter] = useState(false)

  // Load baseline profile for the book
  useEffect(() => {
    if (!currentBook?.id) return
    const loadBaseline = async () => {
      try {
        const baseline = await window.api.styleProfiles.getByBook(currentBook.id)
        setStyleProfiles(currentBook.id, baseline)
      } catch (e) {
        console.error('Failed to load baseline style profile', e)
      }
    }
    loadBaseline()
  }, [currentBook?.id])

  // Load chapter metrics
  useEffect(() => {
    if (!chapterId) return
    const loadChapterMetrics = async () => {
      try {
        const metrics = await window.api.chapterMetrics.getByChapter(chapterId)
        setChapterMetrics(chapterId, metrics)
      } catch (e) {
        console.error('Failed to load chapter metrics', e)
      }
    }
    loadChapterMetrics()
  }, [chapterId])

  const baseline = currentBook?.id ? styleProfiles[currentBook.id] : null
  const metrics = chapterMetrics[chapterId]

  const handleAnalyzeBaseline = async () => {
    const configurationError = getAIConfigurationError(settings)
    if (!settings || configurationError) {
      addToast(configurationError ?? 'Open Settings to configure an AI provider.', 'warning')
      return
    }
    if (!currentBook?.id) {
      addToast('No book selected.', 'error')
      return
    }
    const allContent = chapters
      .filter(c => c.content?.trim())
      .map(c => `--- Chapter: ${c.title} ---\n${c.content}`)
      .join('\n\n')

    if (!allContent) {
      addToast('No chapter content found in this book yet.', 'error')
      return
    }

    setIsAnalyzingBaseline(true)
    try {
      const result = await aiService.analyzeStyleBaseline({
        content: allContent,
        storyContext: storyBible?.premise,
        provider: settings.ai_provider as any,
        apiKey: settings?.ai_api_key, providerSettings: settings?.ai_settings
      })

      const newBaseline = await window.api.styleProfiles.upsert({
        book_id: currentBook.id,
        ...result
      })
      updateStyleProfile(newBaseline)
      addToast('Baseline style profile updated', 'success')
    } catch (error: any) {
      addToast(error.message || 'Failed to analyze baseline', 'error')
    } finally {
      setIsAnalyzingBaseline(false)
    }
  }

  const handleAnalyzeChapter = async () => {
    const configurationError = getAIConfigurationError(settings)
    if (!settings || configurationError) {
      addToast(configurationError ?? 'Open Settings to configure an AI provider.', 'warning')
      return
    }
    const currentChapterData = chapters.find(c => c.id === chapterId)
    if (!currentChapterData?.content?.trim()) {
      addToast('This chapter is empty — add some writing first!', 'error')
      return
    }

    setIsAnalyzingChapter(true)
    try {
      const result = await aiService.analyzeChapterStyle({
        content: currentChapterData.content,
        baseline: baseline || undefined,
        storyContext: storyBible?.premise,
        provider: settings.ai_provider as any,
        apiKey: settings?.ai_api_key, providerSettings: settings?.ai_settings
      })

      const newMetrics = await window.api.chapterMetrics.upsert({
        chapter_id: chapterId,
        ...result
      })
      updateChapterMetric(newMetrics)
      addToast('Chapter metrics updated', 'success')
    } catch (error: any) {
      addToast(error.message || 'Failed to analyze chapter', 'error')
    } finally {
      setIsAnalyzingChapter(false)
    }
  }

  return (
    <EditorToolPanel id="style-panel" title="Style Intelligence" icon={Feather} onClose={onClose}
      action={<PanelAnalyzeButton busy={isAnalyzingChapter} onClick={() => void handleAnalyzeChapter()} />}>
      <section className="space-y-2.5" aria-label="Chapter metrics">
        <h4 className="text-sm font-semibold">Chapter metrics</h4>
        {metrics?.warning && (
          <div className={cn(panelCard, 'flex items-start gap-2.5 border-l-2 border-l-warning-500')}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-500" aria-hidden="true" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">Style drift detected</p>
              <p className="mt-1 break-words text-surface-400">{metrics.warning}</p>
            </div>
          </div>
        )}
        {metrics ? (
          <dl className="grid grid-cols-2 gap-2">
            {styleMetrics.map(([key, label]) => (
              <div key={key} className={cn(panelCard, 'min-w-0', key === 'prose_density' && 'col-span-2')}>
                <dt className="text-xs text-surface-400">{label}</dt>
                <dd className="mt-0.5 break-words text-sm font-semibold">{metrics[key]}</dd>
              </div>
            ))}
          </dl>
        ) : <PanelEmptyState icon={Feather} title="No chapter metrics yet" description="Run AI analysis to check this chapter’s style." />}
      </section>

      <section className="space-y-2.5 border-t border-surface-800 pt-4" aria-label="Baseline profile">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">Baseline profile</h4>
          <PanelAnalyzeButton secondary label={baseline ? 'Refresh baseline' : 'Generate baseline'} busyLabel="Generating…"
            busy={isAnalyzingBaseline} onClick={() => void handleAnalyzeBaseline()} />
        </div>
        {baseline ? (
          <dl className={cn(panelCard, 'divide-y divide-surface-800')}>
            {styleMetrics.map(([key, label]) => (
              <div key={key} className="flex flex-wrap justify-between gap-x-2 gap-y-0.5 py-1.5 text-xs first:pt-0 last:pb-0">
                <dt className="text-surface-400">{label}</dt>
                <dd className="min-w-0 break-words font-medium">{baseline[key]}</dd>
              </div>
            ))}
          </dl>
        ) : <PanelEmptyState icon={Feather} title="No baseline profile yet" description="Generate a book-wide baseline to compare chapter style." />}
      </section>
    </EditorToolPanel>
  )
}
