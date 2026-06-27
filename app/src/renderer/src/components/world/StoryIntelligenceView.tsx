import { useState, useEffect } from 'react'
import { Brain, RefreshCw, Activity, Heart, Zap, Layers, FileText } from 'lucide-react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { aiService } from '../../services/aiService'
import { useToastStore } from '../../stores/toastStore'

export default function StoryIntelligenceView() {
  const { currentBook, chapters, characters } = useWorkspaceStore()
  const { user, settings } = useUserStore()
  const { verseTimelineEvents } = useStoryBibleStore()
  const { addToast } = useToastStore()

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  // States for the different analyses
  const [storyAnalysis, setStoryAnalysis] = useState<any>(null)
  const [arcAnalyses, setArcAnalyses] = useState<any[]>([])
  const [pacingAnalysis, setPacingAnalysis] = useState<any>(null)
  const [emotionAnalysis, setEmotionAnalysis] = useState<any>(null)
  const [chapterStats, setChapterStats] = useState<any[]>([])

  useEffect(() => {
    if (currentBook) {
      loadData()
    }
  }, [currentBook])

  const loadData = async () => {
    if (!currentBook) return
    try {
      const sa = await window.api.storyAnalysis.get(currentBook.id)
      setStoryAnalysis(sa)
      
      const aa = await window.api.arcAnalysis.getByBook(currentBook.id)
      setArcAnalyses(aa || [])
      
      const pa = await window.api.pacingAnalysis.get(currentBook.id)
      setPacingAnalysis(pa)
      
      const ea = await window.api.emotionAnalysis.get(currentBook.id)
      setEmotionAnalysis(ea)
      
      const cs = await window.api.chapterStatistics.getByBook(currentBook.id)
      setChapterStats(cs || [])
    } catch (error) {
      console.error('Failed to load story intelligence data', error)
    }
  }

  const handleAnalyzeStory = async () => {
    if (!currentBook) {
      addToast('No book selected.', 'error')
      return
    }

    if (!settings?.ai_api_key) {
      addToast('Please set your AI API Key in Settings first.', 'error')
      return
    }

    setIsAnalyzing(true)
    try {
      // Load chapters from DB if not in store
      let chaptersToAnalyze = chapters
      if (chaptersToAnalyze.length === 0) {
        chaptersToAnalyze = (await window.api.chapters.getByBook(currentBook.id)) as any[] || []
      }

      if (chaptersToAnalyze.length === 0) {
        addToast('No chapters found to analyze. Please add content first.', 'error')
        setIsAnalyzing(false)
        return
      }

      const allText = chaptersToAnalyze.map((c: any) => (c.title || '') + '\n' + (c.content || '')).join('\n\n---\n\n')
      
      let contextStr = currentBook.story_context || ''
      if (verseTimelineEvents.length > 0) {
        contextStr += '\n\nVERSE TIMELINE RECORD (Global World Events):\n' + [...verseTimelineEvents].sort((a,b) => (a.sort_order||0)-(b.sort_order||0)).map(e => `- ${e.event_date ? `[${e.event_date}] ` : ''}${e.title}: ${e.description}`).join('\n')
      }

      // 1. Analyze Pacing, Emotion, Fatigue, Repetition
      const pacingAndEmotion = await aiService.analyzeStoryPacingAndEmotion({
        content: allText,
        storyContext: contextStr,
        provider: settings.ai_provider as any,
        apiKey: settings.ai_api_key
      })

      // Save pacing
      const savedPacing = await window.api.pacingAnalysis.upsert({
        book_id: currentBook.id,
        pacing_status: pacingAndEmotion.pacing_status,
        conflict_density: pacingAndEmotion.conflict_density
      })
      setPacingAnalysis(savedPacing)

      // Save emotion
      const savedEmotion = await window.api.emotionAnalysis.upsert({
        book_id: currentBook.id,
        emotional_flow_status: pacingAndEmotion.emotional_flow_status,
        warning: pacingAndEmotion.emotion_warning
      })
      setEmotionAnalysis(savedEmotion)

      // Save story analysis
      const savedStory = await window.api.storyAnalysis.upsert({
        book_id: currentBook.id,
        fatigue_warning: pacingAndEmotion.fatigue_warning,
        repetition_warning: pacingAndEmotion.repetition_warning
      })
      setStoryAnalysis(savedStory)

      // 2. Analyze Character Arcs (limit to top 3 characters for performance, or all if small)
      const topCharacters = characters.slice(0, 3)
      for (const char of topCharacters) {
        const arcResult = await aiService.analyzeCharacterArcProgression({
          content: allText,
          characterName: char.name,
          storyContext: contextStr,
          provider: settings.ai_provider as any,
          apiKey: settings.ai_api_key
        })

        await window.api.arcAnalysis.upsert({
          book_id: currentBook.id,
          character_id: char.id,
          arc_status: arcResult.arc_status,
          emotional_change: arcResult.emotional_change
        })
      }
      
      const aa = await window.api.arcAnalysis.getByBook(currentBook.id)
      setArcAnalyses(aa || [])

      // 3. Analyze Chapter Stats (last chapter only for performance)
      const lastChapter = chaptersToAnalyze[chaptersToAnalyze.length - 1]
      if (lastChapter) {
        const statsResult = await aiService.analyzeChapterStatistics({
          content: (lastChapter as any).title + '\n' + (lastChapter as any).content,
          provider: settings.ai_provider as any,
          apiKey: settings.ai_api_key
        })

        await window.api.chapterStatistics.upsert({
          chapter_id: (lastChapter as any).id,
          repetition_warnings: statsResult.repetition_warnings,
          scene_density: statsResult.scene_density
        })
        
        const cs = await window.api.chapterStatistics.getByBook(currentBook.id)
        setChapterStats(cs || [])
      }

      addToast('Story Intelligence analysis complete!', 'success')
    } catch (error: any) {
      console.error('Story analysis error:', error)
      const msg = error?.message || 'Unknown error'
      addToast(`Analysis failed: ${msg}`, 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-surface-900 text-surface-200">
      {/* Header */}
      <div className="shrink-0 p-6 border-b border-surface-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-accent-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Story Intelligence</h1>
            <p className="text-sm text-surface-400">Deep AI analysis of your narrative structure and pacing.</p>
          </div>
        </div>

        <button
          onClick={handleAnalyzeStory}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing Story...' : 'Run Full Analysis'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
        
        {/* Pacing & Conflict */}
        <section className="bg-surface-800 rounded-xl p-5 border border-surface-700">
          <h2 className="text-sm font-bold text-surface-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Pacing & Conflict Analysis
          </h2>
          {pacingAnalysis ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-surface-900 rounded-lg p-4 border border-surface-800">
                <div className="text-xs text-surface-500 mb-1">Overall Pacing</div>
                <div className="text-sm">{pacingAnalysis.pacing_status}</div>
              </div>
              <div className="bg-surface-900 rounded-lg p-4 border border-surface-800">
                <div className="text-xs text-surface-500 mb-1">Conflict Density</div>
                <div className="text-sm">{pacingAnalysis.conflict_density}</div>
              </div>
            </div>
          ) : (
            <p className="text-surface-500 text-sm">Run analysis to view pacing data.</p>
          )}
        </section>

        {/* Emotional Flow */}
        <section className="bg-surface-800 rounded-xl p-5 border border-surface-700">
          <h2 className="text-sm font-bold text-surface-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Heart className="w-4 h-4 text-pink-400" />
            Emotional Flow
          </h2>
          {emotionAnalysis ? (
            <div className="space-y-4">
              <div className="bg-surface-900 rounded-lg p-4 border border-surface-800">
                <div className="text-xs text-surface-500 mb-1">Journey Status</div>
                <div className="text-sm">{emotionAnalysis.emotional_flow_status}</div>
              </div>
              {emotionAnalysis.warning && (
                <div className="bg-red-500/10 text-red-400 rounded-lg p-4 border border-red-500/20 text-sm flex items-start gap-2">
                  <Zap className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold mb-1">Warning Detected</div>
                    {emotionAnalysis.warning}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-surface-500 text-sm">Run analysis to view emotional flow.</p>
          )}
        </section>

        {/* Character Arcs */}
        <section className="bg-surface-800 rounded-xl p-5 border border-surface-700">
          <h2 className="text-sm font-bold text-surface-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            Character Arc Progression
          </h2>
          {arcAnalyses.length > 0 ? (
            <div className="space-y-3">
              {arcAnalyses.map(arc => {
                const char = characters.find(c => c.id === arc.character_id)
                return (
                  <div key={arc.id} className="bg-surface-900 rounded-lg p-4 border border-surface-800 flex flex-col gap-2">
                    <div className="font-bold text-white text-sm">{char?.name || 'Unknown Character'}</div>
                    <div className="text-sm"><span className="text-surface-500">Status:</span> {arc.arc_status}</div>
                    <div className="text-sm"><span className="text-surface-500">Journey:</span> {arc.emotional_change}</div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-surface-500 text-sm">Run analysis to view character arc progressions.</p>
          )}
        </section>

        {/* Fatigue & Repetition */}
        <section className="bg-surface-800 rounded-xl p-5 border border-surface-700">
          <h2 className="text-sm font-bold text-surface-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            Fatigue & Repetition Warnings
          </h2>
          
          <div className="space-y-4">
            {storyAnalysis && (storyAnalysis.fatigue_warning || storyAnalysis.repetition_warning) ? (
              <div className="space-y-3">
                {storyAnalysis.fatigue_warning && (
                  <div className="bg-amber-500/10 text-amber-400 rounded-lg p-4 border border-amber-500/20 text-sm">
                    <span className="font-bold block mb-1">Story Fatigue:</span>
                    {storyAnalysis.fatigue_warning}
                  </div>
                )}
                {storyAnalysis.repetition_warning && (
                  <div className="bg-amber-500/10 text-amber-400 rounded-lg p-4 border border-amber-500/20 text-sm">
                    <span className="font-bold block mb-1">Global Repetition:</span>
                    {storyAnalysis.repetition_warning}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-surface-500 text-sm">No global warnings detected.</p>
            )}

            {chapterStats.length > 0 && (
              <div className="mt-4 pt-4 border-t border-surface-700">
                <div className="text-xs text-surface-500 mb-3">Recent Chapter Statistics</div>
                <div className="space-y-2">
                  {chapterStats.map(stat => {
                    const ch = chapters.find(c => c.id === stat.chapter_id)
                    return (
                      <div key={stat.id} className="bg-surface-900 rounded-lg p-3 border border-surface-800 text-sm">
                        <div className="font-bold text-surface-300 mb-1">{ch?.title || 'Unknown Chapter'}</div>
                        {stat.scene_density && <div className="mb-1"><span className="text-surface-500">Density:</span> {stat.scene_density}</div>}
                        {stat.repetition_warnings && <div className="text-amber-400"><span className="text-surface-500">Warning:</span> {stat.repetition_warnings}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
