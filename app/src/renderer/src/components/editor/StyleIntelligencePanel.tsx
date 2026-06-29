import { useState, useEffect } from 'react'
import { Feather, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useToastStore } from '../../stores/toastStore'
import { aiService } from '../../services/aiService'

export default function StyleIntelligencePanel({ chapterId }: { chapterId: string }) {
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
    if (!settings?.ai_api_key) {
      addToast('Please set your AI API Key in Settings first', 'error')
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
    if (!settings?.ai_api_key) {
      addToast('Please set your AI API Key in Settings first', 'error')
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
    <>
      <div className="flex flex-col h-full bg-surface-900 border-l border-surface-800 animate-in slide-in-from-right-8 duration-200" style={{ width: '320px' }}>
        <div className="p-4 border-b border-surface-800 flex items-center gap-2 text-surface-100">
          <Feather className="w-5 h-5 text-accent-400" />
          <h2 className="font-bold">Style Intelligence</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8">
          
          {/* Chapter Metrics Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Chapter Metrics</h3>
              <button
                onClick={handleAnalyzeChapter}
                disabled={isAnalyzingChapter}
                className="bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
              >
                {isAnalyzingChapter ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {isAnalyzingChapter ? 'Analyzing...' : 'Analyze'}
              </button>
            </div>

            {metrics?.warning && (
              <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 p-3 rounded flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium mb-1 text-orange-300">Style Drift Detected</p>
                  <p>{metrics.warning}</p>
                </div>
              </div>
            )}

            {metrics ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-800 p-3 rounded border border-surface-700">
                  <span className="text-xs text-surface-400 block mb-1">Sentence Length</span>
                  <span className="text-sm font-medium">{metrics.sentence_length}</span>
                </div>
                <div className="bg-surface-800 p-3 rounded border border-surface-700">
                  <span className="text-xs text-surface-400 block mb-1">Dialogue Ratio</span>
                  <span className="text-sm font-medium">{metrics.dialogue_ratio}</span>
                </div>
                <div className="bg-surface-800 p-3 rounded border border-surface-700">
                  <span className="text-xs text-surface-400 block mb-1">Vocabulary</span>
                  <span className="text-sm font-medium">{metrics.vocabulary}</span>
                </div>
                <div className="bg-surface-800 p-3 rounded border border-surface-700">
                  <span className="text-xs text-surface-400 block mb-1">Tone</span>
                  <span className="text-sm font-medium">{metrics.tone}</span>
                </div>
                <div className="bg-surface-800 p-3 rounded border border-surface-700 col-span-2">
                  <span className="text-xs text-surface-400 block mb-1">Prose Density</span>
                  <span className="text-sm font-medium">{metrics.prose_density}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-surface-500 text-center py-4 border border-dashed border-surface-700 rounded">No metrics for this chapter. Run Analyze to check style.</p>
            )}
          </div>

          <div className="h-px bg-surface-800"></div>

          {/* Baseline Profile Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-surface-300">Baseline Profile</h3>
              <button
                onClick={handleAnalyzeBaseline}
                disabled={isAnalyzingBaseline}
                className="bg-surface-700 hover:bg-surface-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
              >
                {isAnalyzingBaseline ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {isAnalyzingBaseline ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {baseline ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm border-b border-surface-800 pb-1">
                  <span className="text-surface-400">Sentence Length</span>
                  <span className="font-medium">{baseline.sentence_length}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-surface-800 pb-1">
                  <span className="text-surface-400">Dialogue Ratio</span>
                  <span className="font-medium">{baseline.dialogue_ratio}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-surface-800 pb-1">
                  <span className="text-surface-400">Vocabulary</span>
                  <span className="font-medium">{baseline.vocabulary}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-b border-surface-800 pb-1">
                  <span className="text-surface-400">Tone</span>
                  <span className="font-medium">{baseline.tone}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-400">Prose Density</span>
                  <span className="font-medium">{baseline.prose_density}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-surface-500 text-center py-4 border border-dashed border-surface-700 rounded">No baseline established. Generate from early chapters.</p>
            )}
          </div>

        </div>
      </div>
    </>
  )
}
