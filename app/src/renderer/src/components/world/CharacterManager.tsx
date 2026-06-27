import { useState, useEffect } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { Camera, Save, Lock, Unlock } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import VoiceIntelligenceTab from './VoiceIntelligenceTab'
import RelationshipIntelligenceTab from './RelationshipIntelligenceTab'

type TabType = 'general' | 'voice' | 'relationships'

export default function CharacterManager({ entityId }: { entityId: string }) {
  const { characters, updateCharacter, panelState, toggleEntityLock, drafts, setDraft, clearDraft } = useWorkspaceStore()
  const { addToast } = useToastStore()
  
  const character = characters.find(c => c.id === entityId)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('general')

  // Use the in-memory draft if one exists, otherwise fall back to the saved entity.
  // This means switching tabs and coming back preserves unsaved edits.
  const draft = drafts[entityId]
  const formData = draft ?? character ?? null

  // When the character entity itself changes (e.g., renamed from sidebar),
  // update the draft to reflect the new base — but only if there's no local draft yet.
  useEffect(() => {
    if (character && !drafts[entityId]) {
      // No draft yet — no action needed; formData already points to `character`
    }
  }, [character?.id])

  if (!formData) return <div>Character not found</div>

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    // Write the updated draft back to the store so it survives tab switches
    setDraft(entityId, { ...(drafts[entityId] ?? character ?? {}), [name]: value })
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setDraft(entityId, { ...(drafts[entityId] ?? character ?? {}), image_url: reader.result as string })
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!formData) return
    setIsSaving(true)
    try {
      const updated = await window.api.characters.update(formData)
      updateCharacter(updated as any)
      // Clear the draft now that changes are persisted to SQLite
      clearDraft(entityId)
      addToast('Character saved', 'success')
    } catch {
      addToast('Failed to save character', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const isDirty = !!drafts[entityId]

  return (
    <div className="p-8 max-w-4xl mx-auto overflow-y-auto h-full text-surface-200">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-surface-100">{formData.name || 'Unnamed Character'}</h1>
          {isDirty && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning-500/15 text-warning-400 border border-warning-500/20">
              Unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleEntityLock(entityId)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md font-medium transition-colors border",
              panelState.lockedEntities?.includes(entityId)
                ? "bg-accent-900/30 text-accent-400 border-accent-800 hover:bg-accent-900/50"
                : "bg-surface-800 text-surface-400 border-surface-700 hover:bg-surface-700 hover:text-surface-300"
            )}
            title="Lock this character into AI context"
          >
            {panelState.lockedEntities?.includes(entityId) ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span className="text-sm">Memory Lock</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-accent-600 hover:bg-accent-500 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex border-b border-surface-700 mb-6 gap-6">
        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            "pb-3 text-sm font-medium transition-colors border-b-2",
            activeTab === 'general' ? "border-accent-500 text-accent-400" : "border-transparent text-surface-400 hover:text-surface-200"
          )}
        >
          General Info
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          className={cn(
            "pb-3 text-sm font-medium transition-colors border-b-2",
            activeTab === 'voice' ? "border-accent-500 text-accent-400" : "border-transparent text-surface-400 hover:text-surface-200"
          )}
        >
          Voice Intelligence
        </button>
        <button
          onClick={() => setActiveTab('relationships')}
          className={cn(
            "pb-3 text-sm font-medium transition-colors border-b-2",
            activeTab === 'relationships' ? "border-accent-500 text-accent-400" : "border-transparent text-surface-400 hover:text-surface-200"
          )}
        >
          Relationships
        </button>
      </div>

      {activeTab === 'general' ? (
        <div className="grid grid-cols-3 gap-8">
          {/* Left Column: Image & Basic Info */}
        <div className="col-span-1 space-y-6">
          <div className="relative group">
            <div className="aspect-[3/4] bg-surface-800 rounded-lg overflow-hidden border border-surface-700 flex items-center justify-center">
              {formData.image_url ? (
                <img src={formData.image_url} alt={formData.name} className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-12 h-12 text-surface-600" />
              )}
            </div>
            <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity rounded-lg">
              <span className="text-white text-sm font-medium">Upload Image</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Name</label>
              <input name="name" value={formData.name} onChange={handleChange} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Nickname</label>
              <input name="nickname" value={formData.nickname} onChange={handleChange} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Age</label>
                <input name="age" value={formData.age} onChange={handleChange} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Gender</label>
                <input name="gender" value={formData.gender} onChange={handleChange} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Info */}
        <div className="col-span-2 space-y-6">
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Appearance</label>
            <textarea name="appearance" value={formData.appearance} onChange={handleChange} rows={3} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500 resize-none" placeholder="Physical features, clothing, distinguishing marks..."></textarea>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Personality</label>
            <textarea name="personality" value={formData.personality} onChange={handleChange} rows={3} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500 resize-none" placeholder="Traits, habits, fears, desires..."></textarea>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Goals & Motivations</label>
            <textarea name="goals" value={formData.goals} onChange={handleChange} rows={3} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500 resize-none" placeholder="What do they want? Why do they want it?"></textarea>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Relationships</label>
            <textarea name="relationships" value={formData.relationships} onChange={handleChange} rows={3} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500 resize-none" placeholder="Family, friends, enemies..."></textarea>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Other Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500 resize-none" placeholder="Backstory, secrets, random facts..."></textarea>
          </div>
        </div>
      </div>
      ) : activeTab === 'voice' ? (
        <VoiceIntelligenceTab characterId={entityId} />
      ) : (
        <RelationshipIntelligenceTab characterId={entityId} />
      )}
    </div>
  )
}
