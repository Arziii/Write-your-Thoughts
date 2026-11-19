import { useState, useEffect } from 'react'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { Plus, Trash2, Heart, Activity } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { aiService } from '../../services/aiService'
import type { ChapterEmotion } from '../../types'
import { cn } from '../../utils'
import { EditorToolPanel, PanelAnalyzeButton, PanelEmptyState, panelBadge, panelButton, panelCard, panelField, panelIconButton } from './EditorToolPanel'

const emotionOptions = ['Fear', 'Joy', 'Sadness', 'Romance', 'Anger', 'Tension', 'Suspense', 'Hope', 'Grief', 'Neutral']

export default function EmotionPanel({ chapterId, onClose }: { chapterId: string; onClose: () => void }) {
  const { 
    updateChapterEmotion,
    sceneEmotions, setSceneEmotions, addSceneEmotion, removeSceneEmotion,
    storyBible
  } = useStoryBibleStore()
  const { addToast } = useToastStore()
  const { settings } = useUserStore()
  const { chapters } = useWorkspaceStore()

  const [emotion, setEmotion] = useState<ChapterEmotion | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [showSceneForm, setShowSceneForm] = useState(false)
  const [savingScene, setSavingScene] = useState(false)
  
  const [newSceneDescription, setNewSceneDescription] = useState('')
  const [newSceneEmotion, setNewSceneEmotion] = useState('Tension')
  const [newSceneIntensity, setNewSceneIntensity] = useState(5)

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [cEmotion, sceneData] = await Promise.all([
          window.api.chapterEmotions.getByChapter(chapterId),
          window.api.sceneEmotions.getByChapter(chapterId),
        ])
        if (cancelled) return
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

        setSceneEmotions(chapterId, sceneData)
      } catch (e) {
        console.error('Failed to load emotional intelligence', e)
        if (!cancelled) setLoadFailed(true)
      }
    }
    void loadData()
    return () => { cancelled = true }
  }, [chapterId])

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
        apiKey: settings?.ai_api_key, providerSettings: settings?.ai_settings
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
    if (!newSceneDescription.trim() || savingScene) return
    setSavingScene(true)
    try {
      const added = await window.api.sceneEmotions.create({
        chapter_id: chapterId,
        scene_description: newSceneDescription.trim(),
        primary_emotion: newSceneEmotion,
        intensity: newSceneIntensity
      })
      addSceneEmotion(added)
      setNewSceneDescription('')
      setNewSceneIntensity(5)
      setShowSceneForm(false)
    } catch {
      addToast('Failed to add scene emotion', 'error')
    } finally {
      setSavingScene(false)
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

  const scenes = sceneEmotions[chapterId] ?? []

  return (
    <EditorToolPanel id="emotion-panel" title="Emotional Intelligence" icon={Heart} onClose={onClose}
      action={<PanelAnalyzeButton busy={isAnalyzing} disabled={!emotion} onClick={() => void handleAnalyzeWithAI()} />}>
      {!emotion ? (
        loadFailed
          ? <PanelEmptyState icon={Heart} title="Could not load the emotional arc" description="Reopen this panel to try again." />
          : <p role="status" className="text-sm text-surface-400">Loading emotional arc…</p>
      ) : (
        <>
          <section className="space-y-2.5" aria-label="Chapter arc">
            <h4 className="text-sm font-semibold">Chapter arc</h4>
            <div className={cn(panelCard, 'space-y-3')}>
              {([
                ['Primary emotion', emotion.primary_emotion, handleUpdatePrimary],
                ['Secondary emotion', emotion.secondary_emotion, handleUpdateSecondary],
              ] as const).map(([label, value, onChange]) => (
                <label key={label} className="block space-y-1">
                  <span className="text-xs text-surface-400">{label}</span>
                  <select className={panelField} value={value} onChange={event => void onChange(event.target.value)}>
                    <option value="">Select emotion</option>
                    {value && !emotionOptions.includes(value) && <option>{value}</option>}
                    {emotionOptions.map(option => <option key={option}>{option}</option>)}
                  </select>
                </label>
              ))}
              <label className="block space-y-1">
                <span className="flex items-center justify-between gap-2 text-xs text-surface-400">
                  Overall intensity <span className={panelBadge}>{emotion.intensity}/10</span>
                </span>
                <input type="range" min={0} max={10} value={emotion.intensity}
                  onChange={event => void handleUpdateIntensity(Number(event.target.value))}
                  className="w-full accent-[hsl(var(--brand-green))]" />
              </label>
            </div>
          </section>

          <section className="space-y-2.5 border-t border-surface-800 pt-4" aria-label="Scene breakdown">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 text-sm font-semibold"><Activity className="h-4 w-4" aria-hidden="true" /> Scene breakdown</h4>
              {!showSceneForm && <button type="button" onClick={() => setShowSceneForm(true)} className={panelButton}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add scene
              </button>}
            </div>
            {showSceneForm && (
              <form className={cn(panelCard, 'space-y-2')} onSubmit={event => {
                event.preventDefault()
                void handleAddSceneEmotion()
              }}>
                <input autoFocus aria-label="Scene description" className={panelField} value={newSceneDescription}
                  onChange={event => setNewSceneDescription(event.target.value)} placeholder="Scene description" />
                <select aria-label="Scene emotion" className={panelField} value={newSceneEmotion}
                  onChange={event => setNewSceneEmotion(event.target.value)}>
                  {emotionOptions.map(option => <option key={option}>{option}</option>)}
                </select>
                <label className="block space-y-1">
                  <span className="flex items-center justify-between gap-2 text-xs text-surface-400">
                    Scene intensity <span className={panelBadge}>{newSceneIntensity}/10</span>
                  </span>
                  <input type="range" min={0} max={10} value={newSceneIntensity} className="w-full accent-[hsl(var(--brand-green))]"
                    onChange={event => setNewSceneIntensity(Number(event.target.value))} />
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" className={panelButton} disabled={savingScene} onClick={() => setShowSceneForm(false)}>Cancel</button>
                  <button type="submit" className={panelButton} disabled={!newSceneDescription.trim() || savingScene}>
                    {savingScene ? 'Adding…' : 'Add scene'}
                  </button>
                </div>
              </form>
            )}
            {scenes.length > 0 ? (
              <ul className="space-y-2">
                {scenes.map(scene => (
                  <li key={scene.id} className={panelCard}>
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                      <span className={panelBadge}>{scene.primary_emotion} · {scene.intensity}/10</span>
                      <button type="button" onClick={() => void handleDeleteSceneEmotion(scene.id)} aria-label="Delete scene marker"
                        title="Delete scene marker" className={`${panelIconButton} hover:text-danger-500`}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="break-words text-sm leading-relaxed">{scene.scene_description}</p>
                  </li>
                ))}
              </ul>
            ) : <PanelEmptyState icon={Activity} title="No scene markers yet" description="Add a scene or run AI analysis to suggest markers." />}
          </section>
        </>
      )}
    </EditorToolPanel>
  )
}
