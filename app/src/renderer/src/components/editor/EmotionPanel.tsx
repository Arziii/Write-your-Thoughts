import { useState, useEffect } from 'react'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { Plus, Trash2, Heart, Activity, Sparkles, RefreshCw } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { aiService } from '../../services/aiService'
import type { ChapterEmotion, SceneEmotion } from '../../types'

export default function EmotionPanel({ chapterId }: { chapterId: string }) {
  const { 
    chapterEmotions, updateChapterEmotion,
    sceneEmotions, setSceneEmotions, addSceneEmotion, removeSceneEmotion,
    storyBible
  } = useStoryBibleStore()
  const { addToast } = useToastStore()
  const { settings } = useUserStore()
  const { chapters } = useWorkspaceStore()

  const [emotion, setEmotion] = useState<ChapterEmotion | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  const [newSceneDescription, setNewSceneDescription] = useState('')
  const [newSceneEmotion, setNewSceneEmotion] = useState('Tension')
  const [newSceneIntensity, setNewSceneIntensity] = useState(5)

  useEffect(() => {
    const loadData = async () => {
      try {
        const cEmotion = await window.api.chapterEmotions.getByChapter(chapterId)
        if (cEmotion) {
          setEmotion(cEmotion)
          updateChapterEmotion(cEmotion)
        } else {
          setEmotion({
            id: '',
            chapter_id: chapterId,
            primary_emotion: '',
            secondary_emotion: '',
            intensity: 5,
            created_at: '',
            updated_at: ''
          })
        }

        const sEmotions = await window.api.sceneEmotions.getByChapter(chapterId)
        setSceneEmotions(chapterId, sEmotions)
      } catch (e) {
        console.error('Failed to load emotional intelligence', e)
      }
    }
    loadData()
  }, [chapterId])

  const activeChapter = chapters.find(c => c.id === chapterId)

  const handleAnalyzeWithAI = async () => {
    if (!settings?.ai_api_key) {
      addToast('Please set your AI API Key in Settings first', 'error')
      return
    }
    // Use all chapter content (whole story)
    const allContent = chapters
      .filter(c => c.content?.trim())
      .map(c => `--- Chapter: ${c.title} ---\n${c.content}`)
      .join('\n\n')

    if (!allContent) {
      addToast('No chapter content found in this book yet.', 'error')
      return
    }

    setIsAnalyzing(true)
    try {
      const result = await aiService.analyzeEmotion({
        content: allContent,
        storyContext: storyBible?.premise,
        provider: settings.ai_provider as any,
        apiKey: settings.ai_api_key
      })

      // Guard against empty fallback data
      if (!result.primary_emotion) {
        addToast('AI analysis returned no data. Check your API key or try again.', 'error')
        return
      }

      // Upsert chapter-level emotion
      const updatedEmotion: ChapterEmotion = {
        ...(emotion!),
        primary_emotion: result.primary_emotion,
        secondary_emotion: result.secondary_emotion,
        intensity: result.intensity
      }
      const saved = await window.api.chapterEmotions.upsert(updatedEmotion)
      setEmotion(saved)
      updateChapterEmotion(saved)

      // Add scene breakdowns
      for (const scene of result.scenes || []) {
        const added = await window.api.sceneEmotions.create({
          chapter_id: chapterId,
          scene_description: scene.scene_description,
          primary_emotion: scene.primary_emotion,
          intensity: scene.intensity
        })
        addSceneEmotion(added)
      }

      addToast('Emotional arc analyzed by AI!', 'success')
    } catch (e: any) {
      console.error(e)
      addToast(e.message || 'AI analysis failed.', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleUpdatePrimary = async (val: string) => {
    if (!emotion) return
    const updated = { ...emotion, primary_emotion: val }
    setEmotion(updated)
    await saveChapterEmotion(updated)
  }

  const handleUpdateSecondary = async (val: string) => {
    if (!emotion) return
    const updated = { ...emotion, secondary_emotion: val }
    setEmotion(updated)
    await saveChapterEmotion(updated)
  }

  const handleUpdateIntensity = async (val: number) => {
    if (!emotion) return
    const updated = { ...emotion, intensity: val }
    setEmotion(updated)
    await saveChapterEmotion(updated)
  }

  const saveChapterEmotion = async (data: ChapterEmotion) => {
    try {
      const res = await window.api.chapterEmotions.upsert(data)
      updateChapterEmotion(res)
    } catch {
      addToast('Failed to save chapter emotion', 'error')
    }
  }

  const handleAddSceneEmotion = async () => {
    if (!newSceneDescription.trim()) return
    try {
      const added = await window.api.sceneEmotions.create({
        chapter_id: chapterId,
        scene_description: newSceneDescription,
        primary_emotion: newSceneEmotion,
        intensity: newSceneIntensity
      })
      addSceneEmotion(added)
      setNewSceneDescription('')
      setNewSceneIntensity(5)
    } catch {
      addToast('Failed to add scene emotion', 'error')
    }
  }

  const handleDeleteSceneEmotion = async (id: string) => {
    try {
      await window.api.sceneEmotions.delete(id)
      removeSceneEmotion(chapterId, id)
    } catch {
      addToast('Failed to delete scene emotion', 'error')
    }
  }

  if (!emotion) return <div className="p-4 text-surface-400">Loading Emotional Intelligence...</div>

  const sList = sceneEmotions[chapterId] || []
  const EMO_OPTIONS = ['Fear', 'Joy', 'Sadness', 'Romance', 'Anger', 'Tension', 'Suspense', 'Hope', 'Grief', 'Neutral']

  return (
    <>
    <div className="flex flex-col h-full bg-surface-900 border-l border-surface-800 animate-in slide-in-from-right-8 duration-200" style={{ width: '320px' }}>
      <div className="p-4 border-b border-surface-800 flex items-center justify-between text-surface-100">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-accent-400" />
          <h3 className="font-semibold text-sm">Emotional Intelligence</h3>
        </div>
        <button
          onClick={handleAnalyzeWithAI}
          disabled={isAnalyzing}
          className="bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors"
        >
          {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {isAnalyzing ? 'Analyzing whole story...' : 'AI Analyze'}
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        
        {/* Chapter Overview */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Chapter Arc</h4>
          <p className="text-xs text-surface-500">AI-detected values, or adjust manually below.</p>
          
          <div>
            <label className="block text-xs text-surface-400 mb-1">Primary Emotion</label>
            <select 
              value={emotion.primary_emotion} 
              onChange={e => handleUpdatePrimary(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm text-surface-200 focus:outline-none focus:border-accent-500"
            >
              <option value="">Select Emotion...</option>
              {EMO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-surface-400 mb-1">Secondary Emotion</label>
            <select 
              value={emotion.secondary_emotion} 
              onChange={e => handleUpdateSecondary(e.target.value)}
              className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm text-surface-200 focus:outline-none focus:border-accent-500"
            >
              <option value="">Select Emotion...</option>
              {EMO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-surface-400 mb-1 flex justify-between">
              <span>Overall Intensity</span>
              <span className="font-semibold text-accent-400">{emotion.intensity}/10</span>
            </label>
            <input 
              type="range" min="0" max="10" 
              value={emotion.intensity}
              onChange={e => handleUpdateIntensity(Number(e.target.value))}
              className="w-full accent-accent-500"
            />
          </div>
        </div>

        {/* Scene Emotions */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4" /> Scene Breakdown
          </h4>
          
          <div className="space-y-2 mb-4 p-3 bg-surface-800 border border-surface-700 rounded-lg">
            <input 
              value={newSceneDescription}
              onChange={e => setNewSceneDescription(e.target.value)}
              placeholder="Scene description (e.g. Confrontation)"
              className="w-full bg-surface-900 border border-surface-700 rounded p-2 text-sm text-surface-200 focus:outline-none focus:border-accent-500"
              onKeyDown={e => e.key === 'Enter' && handleAddSceneEmotion()}
            />
            <div className="flex gap-2">
              <select 
                value={newSceneEmotion}
                onChange={e => setNewSceneEmotion(e.target.value)}
                className="flex-1 bg-surface-900 border border-surface-700 rounded p-2 text-sm text-surface-200 focus:outline-none focus:border-accent-500"
              >
                {EMO_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <div className="flex items-center gap-2 text-surface-200 text-sm">
                <span className="text-xs w-4">{newSceneIntensity}</span>
                <input 
                  type="range" min="0" max="10" 
                  value={newSceneIntensity}
                  onChange={e => setNewSceneIntensity(Number(e.target.value))}
                  className="w-16 accent-accent-500"
                />
              </div>
            </div>
            <button 
              onClick={handleAddSceneEmotion}
              className="w-full bg-surface-700 hover:bg-surface-600 text-surface-200 rounded p-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 mt-2"
            >
              <Plus className="w-4 h-4" /> Add Scene Marker
            </button>
          </div>

          <div className="space-y-2">
            {sList.map(scene => (
              <div key={scene.id} className="bg-surface-800 border border-surface-700 rounded p-3 group relative">
                <div className="flex justify-between items-start mb-1 pr-8">
                  <span className="text-sm font-medium text-surface-200">{scene.scene_description}</span>
                  <span className="text-xs px-2 py-0.5 bg-surface-700 text-surface-300 rounded-full flex-shrink-0">{scene.primary_emotion} {scene.intensity}/10</span>
                </div>
                <button 
                  onClick={() => handleDeleteSceneEmotion(scene.id)}
                  className="absolute top-3 right-3 text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {sList.length === 0 && (
              <p className="text-xs text-surface-500 text-center py-4 border border-dashed border-surface-700 rounded">No scene markers yet. Hit AI Analyze to auto-detect!</p>
            )}
          </div>

        </div>

      </div>
    </div>

  </>
  )
}
