import { useState, useEffect } from 'react'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { Plus, Trash2, Save, Sparkles, RefreshCw } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { useUserStore } from '../../stores/userStore'
import { aiService } from '../../services/aiService'
import type { CharacterVoiceProfile, SpeechPattern, DialogueSample } from '../../types'

interface Props {
  characterId: string
}

export default function VoiceIntelligenceTab({ characterId }: Props) {
  const { 
    voiceProfiles, updateVoiceProfile,
    speechPatterns, setSpeechPatterns, addSpeechPattern, removeSpeechPattern,
    dialogueSamples, setDialogueSamples, addDialogueSample, removeDialogueSample,
    storyBible
  } = useStoryBibleStore()
  const { addToast } = useToastStore()
  const { settings } = useUserStore()
  const { chapters } = useWorkspaceStore()

  const [profile, setProfile] = useState<CharacterVoiceProfile | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const [newPattern, setNewPattern] = useState('')
  const [newSample, setNewSample] = useState({ text: '', context: '' })

  useEffect(() => {
    const loadData = async () => {
      try {
        const p = await window.api.characterVoice.getProfile(characterId)
        if (p) {
          setProfile(p)
          updateVoiceProfile(p)
        } else {
          setProfile({
            id: '',
            character_id: characterId,
            vocabulary: '',
            sentence_length: '',
            formality: '',
            personality: '',
            mood: '',
            emotional_state: '',
            created_at: '',
            updated_at: ''
          })
        }

        const patterns = await window.api.speechPatterns.getByCharacter(characterId)
        setSpeechPatterns(characterId, patterns)

        const samples = await window.api.dialogueSamples.getByCharacter(characterId)
        setDialogueSamples(characterId, samples)
      } catch (e) {
        console.error(e)
      }
    }
    loadData()
  }, [characterId])

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (!profile) return
    setProfile({ ...profile, [e.target.name]: e.target.value })
  }

  const handleSaveProfile = async () => {
    if (!profile) return
    setIsSaving(true)
    try {
      const updated = await window.api.characterVoice.upsertProfile(profile)
      setProfile(updated)
      updateVoiceProfile(updated)
      addToast('Voice profile saved', 'success')
    } catch {
      addToast('Failed to save voice profile', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAnalyzeWithAI = async () => {
    if (!settings?.ai_api_key) {
      addToast('Please set your AI API Key in Settings first', 'error')
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

    setIsAnalyzing(true)
    try {
      const result = await aiService.analyzeVoice({
        content: allContent,
        storyContext: storyBible?.premise,
        provider: settings.ai_provider as any,
        apiKey: settings?.ai_api_key, providerSettings: settings?.ai_settings
      })

      // Guard against empty fallback data (means AI call failed silently)
      if (!result.vocabulary && !result.personality && !result.mood) {
        addToast('AI analysis returned no data. Check your API key or try again.', 'error')
        return
      }

      // Update profile fields
      const updatedProfile: CharacterVoiceProfile = {
        ...(profile!),
        vocabulary: result.vocabulary || profile?.vocabulary || '',
        sentence_length: result.sentence_length || profile?.sentence_length || '',
        formality: result.formality || profile?.formality || '',
        personality: result.personality || profile?.personality || '',
        mood: result.mood || profile?.mood || '',
        emotional_state: result.emotional_state || profile?.emotional_state || '',
      }
      setProfile(updatedProfile)
      const saved = await window.api.characterVoice.upsertProfile(updatedProfile)
      updateVoiceProfile(saved)

      // Add speech patterns
      for (const p of result.patterns || []) {
        const added = await window.api.speechPatterns.create({ character_id: characterId, pattern_description: p })
        addSpeechPattern(added)
      }

      // Add dialogue samples
      for (const s of result.samples || []) {
        const added = await window.api.dialogueSamples.create({ character_id: characterId, sample_text: s, context: 'AI Extracted' })
        addDialogueSample(added)
      }

      addToast('Voice profile populated by AI!', 'success')
    } catch (e: any) {
      console.error(e)
      addToast(e.message || 'AI analysis failed.', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAddPattern = async () => {
    if (!newPattern.trim()) return
    try {
      const added = await window.api.speechPatterns.create({ character_id: characterId, pattern_description: newPattern })
      addSpeechPattern(added)
      setNewPattern('')
    } catch {
      addToast('Failed to add speech pattern', 'error')
    }
  }

  const handleDeletePattern = async (id: string) => {
    try {
      await window.api.speechPatterns.delete(id)
      removeSpeechPattern(characterId, id)
    } catch {
      addToast('Failed to delete speech pattern', 'error')
    }
  }

  const handleAddSample = async () => {
    if (!newSample.text.trim()) return
    try {
      const added = await window.api.dialogueSamples.create({ 
        character_id: characterId, 
        sample_text: newSample.text, 
        context: newSample.context 
      })
      addDialogueSample(added)
      setNewSample({ text: '', context: '' })
    } catch {
      addToast('Failed to add dialogue sample', 'error')
    }
  }

  const handleDeleteSample = async (id: string) => {
    try {
      await window.api.dialogueSamples.delete(id)
      removeDialogueSample(characterId, id)
    } catch {
      addToast('Failed to delete dialogue sample', 'error')
    }
  }

  if (!profile) return <div className="p-4 text-surface-400">Loading...</div>

  const patternsList = speechPatterns[characterId] || []
  const samplesList = dialogueSamples[characterId] || []

  return (
    <>
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* AI Banner */}
      <div className="bg-accent-950/40 border border-accent-800/50 rounded-lg p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-accent-300">AI Voice Analysis</p>
          <p className="text-xs text-surface-400 mt-0.5">
            AI will read <span className="text-accent-400 font-semibold">all {chapters.length} chapter(s)</span> and build this character's voice profile automatically.
          </p>
        </div>
        <button
          onClick={handleAnalyzeWithAI}
          disabled={isAnalyzing}
          className="flex-shrink-0 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
        >
          {isAnalyzing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isAnalyzing ? 'Analyzing whole story...' : 'AI Analyze'}
        </button>
      </div>

      {/* Voice Profile Card */}
      <div className="bg-surface-800 border border-surface-700 rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-surface-100">Voice Profile</h3>
            <p className="text-sm text-surface-400">Core attributes of how this character speaks. Auto-filled by AI or edit manually.</p>
          </div>
          <button
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="flex items-center gap-2 bg-surface-700 hover:bg-surface-600 text-surface-200 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Vocabulary</label>
            <input name="vocabulary" value={profile.vocabulary} onChange={handleProfileChange} placeholder="e.g. Educated, simple, archaic..." className="w-full bg-surface-900 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Sentence Length</label>
            <input name="sentence_length" value={profile.sentence_length} onChange={handleProfileChange} placeholder="e.g. Short, Medium, Long, Mixed" className="w-full bg-surface-900 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Formality</label>
            <input name="formality" value={profile.formality} onChange={handleProfileChange} placeholder="e.g. Casual, Neutral, Formal" className="w-full bg-surface-900 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Personality (in speech)</label>
            <input name="personality" value={profile.personality} onChange={handleProfileChange} placeholder="e.g. Sarcastic, earnest..." className="w-full bg-surface-900 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Default Mood</label>
            <input name="mood" value={profile.mood} onChange={handleProfileChange} placeholder="e.g. Cheerful, brooding..." className="w-full bg-surface-900 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Emotional State</label>
            <input name="emotional_state" value={profile.emotional_state} onChange={handleProfileChange} placeholder="e.g. Stable, erratic..." className="w-full bg-surface-900 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Speech Patterns */}
        <div className="bg-surface-800 border border-surface-700 rounded-lg p-6 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-surface-100">Speech Patterns</h3>
            <p className="text-sm text-surface-400">Specific quirks or habits in their dialogue. Auto-extracted by AI or add manually.</p>
          </div>
          
          <div className="flex gap-2 mb-4">
            <input 
              value={newPattern} 
              onChange={e => setNewPattern(e.target.value)} 
              placeholder="e.g. Always answers questions with a question." 
              className="flex-1 bg-surface-900 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500"
              onKeyDown={e => e.key === 'Enter' && handleAddPattern()}
            />
            <button onClick={handleAddPattern} className="bg-accent-600 hover:bg-accent-500 text-white p-2 rounded flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {patternsList.map(pattern => (
              <div key={pattern.id} className="bg-surface-900/50 border border-surface-700 rounded p-3 flex justify-between items-start gap-4 group">
                <span className="text-sm text-surface-200">{pattern.pattern_description}</span>
                <button onClick={() => handleDeletePattern(pattern.id)} className="text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {patternsList.length === 0 && (
              <div className="text-center text-sm text-surface-500 py-4 border border-dashed border-surface-700 rounded">No speech patterns yet. Use AI Analyze to auto-detect!</div>
            )}
          </div>
        </div>

        {/* Dialogue Samples */}
        <div className="bg-surface-800 border border-surface-700 rounded-lg p-6 flex flex-col">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-surface-100">Canonical Dialogue Samples</h3>
            <p className="text-sm text-surface-400">Examples of exactly how they speak. AI will extract quotes automatically.</p>
          </div>

          <div className="space-y-2 mb-4">
            <textarea 
              value={newSample.text} 
              onChange={e => setNewSample({ ...newSample, text: e.target.value })} 
              placeholder="Type a quote or paste dialogue here..." 
              className="w-full bg-surface-900 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500 resize-none h-20"
            />
            <div className="flex gap-2">
              <input 
                value={newSample.context} 
                onChange={e => setNewSample({ ...newSample, context: e.target.value })} 
                placeholder="Context (optional)" 
                className="flex-1 bg-surface-900 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500"
                onKeyDown={e => e.key === 'Enter' && handleAddSample()}
              />
              <button onClick={handleAddSample} className="bg-accent-600 hover:bg-accent-500 text-white px-3 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {samplesList.map(sample => (
              <div key={sample.id} className="bg-surface-900/50 border border-surface-700 rounded p-3 flex justify-between items-start gap-4 group">
                <div className="flex-1">
                  <p className="text-sm text-surface-200 italic mb-1">"{sample.sample_text}"</p>
                  {sample.context && <p className="text-xs text-surface-500">— {sample.context}</p>}
                </div>
                <button onClick={() => handleDeleteSample(sample.id)} className="text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {samplesList.length === 0 && (
              <div className="text-center text-sm text-surface-500 py-4 border border-dashed border-surface-700 rounded">No dialogue samples yet. Use AI Analyze to auto-extract!</div>
            )}
          </div>
        </div>
      </div>
    </div>

  </>
  )
}
