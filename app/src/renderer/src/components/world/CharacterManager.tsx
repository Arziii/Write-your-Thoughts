import { useState, useEffect } from 'react'
import { useEditorSave } from '../../hooks/useEditorSave'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { ImagePlus, Save, Lock, Unlock, Loader2, Users } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import VoiceIntelligenceTab from './VoiceIntelligenceTab'
import RelationshipIntelligenceTab from './RelationshipIntelligenceTab'
import { uploadImage } from '../../services/storageService'

const characterTabs = [
  { id: 'general', label: 'General Info' },
  { id: 'voice', label: 'Voice Intelligence' },
] as const

type TabType = typeof characterTabs[number]['id']

export default function CharacterManager({ entityId }: { entityId: string }) {
  const { characters, updateCharacter, panelState, toggleEntityLock, drafts } = useWorkspaceStore()
  const { addToast } = useToastStore()
  
  const character = characters.find(c => c.id === entityId)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
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

  const saving = useEditorSave(entityId, async (change: Record<string, unknown>) => {
    const original = useWorkspaceStore.getState().characters.find(item => item.id === entityId)
    const fields = ['name', 'nickname', 'age', 'gender', 'appearance', 'personality', 'goals', 'relationships', 'notes', 'image_url'] as const
    const changed = Object.fromEntries(fields.filter(field => change[field] !== original?.[field]).map(field => [field, change[field]]))
    if (original && !Object.keys(changed).length) return
    const updated = await window.api.characters.update({ id: entityId, ...changed })
    if (!updated) throw new Error('Record could not be found')
    updateCharacter(updated)
  })
  const isSaving = saving.status === 'saving'

  if (!formData) return <div>Character not found</div>

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    // Write the updated draft back to the store so it survives tab switches
    saving.stage({ ...(useWorkspaceStore.getState().drafts[entityId] ?? character ?? {}), [name]: value })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { addToast('Image must be under 5MB', 'error'); return }

    setIsUploadingImage(true)
    try {
      const url = await uploadImage(file, 'characters', entityId)
      saving.stage({ ...(useWorkspaceStore.getState().drafts[entityId] ?? character ?? {}), image_url: url })
      addToast('Image uploaded', 'success')
    } catch (err: any) {
      addToast(err.message || 'Upload failed', 'error')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleImageDelete = () => {
    saving.stage({ ...(useWorkspaceStore.getState().drafts[entityId] ?? character ?? {}), image_url: '' })
  }

  const isDirty = !!drafts[entityId]

  return (
    <div className="reference-profile h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-7">
        <header className="reference-card flex flex-wrap items-center justify-between gap-2 !px-3 !py-2">
          <div className="flex flex-wrap items-center gap-2">
            {characterTabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={activeTab === id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  activeTab === id
                    ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                    : 'text-surface-400 hover:bg-surface-900 hover:text-surface-100'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {isDirty && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-warning-500/15 text-warning-400 border border-warning-500/20">
                Unsaved
              </span>
            )}
            <button
              onClick={() => toggleEntityLock(entityId)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md font-medium transition-colors border",
                panelState.lockedEntities?.includes(entityId)
                  ? "bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))] border-current hover:brightness-95"
                  : "text-[hsl(var(--brand-green))] border-current hover:bg-[hsl(var(--brand-green-bg))]"
              )}
              title="Lock this character into AI context"
            >
              {panelState.lockedEntities?.includes(entityId) ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span className="text-sm">Memory Lock</span>
            </button>
            <button
              onClick={() => void saving.save()}
              disabled={isSaving}
              className="flex items-center gap-2 border border-transparent bg-[hsl(var(--brand-green-bg))] hover:brightness-95 disabled:opacity-50 text-[hsl(var(--brand-green))] px-3 py-1.5 text-sm rounded-md font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </header>

        {activeTab === 'general' ? (
          <div className="profile-worksheet">
            <div className="profile-worksheet-intro">
              <div className="profile-worksheet-portrait group" role="group" aria-label="Character picture" aria-busy={isUploadingImage}>
                <label className="absolute inset-0 grid cursor-pointer place-items-center focus-within:outline focus-within:-outline-offset-4" title={formData.image_url ? 'Replace image' : 'Upload image'}>
                  <input
                    type="file"
                    accept="image/*"
                    aria-label={formData.image_url ? 'Replace character image' : 'Upload character image'}
                    onChange={handleImageUpload}
                    disabled={isUploadingImage}
                    className="sr-only"
                  />
                  {formData.image_url ? (
                    <img src={formData.image_url} alt={`Portrait of ${formData.name || 'this character'}`} className="absolute inset-0 h-full w-full object-contain" />
                  ) : (
                    <span className="flex flex-col items-center gap-2">
                      <ImagePlus className="h-7 w-7" aria-hidden="true" />
                      Upload image
                    </span>
                  )}
                  {formData.image_url && (
                    <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/80 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      Replace image
                    </span>
                  )}
                </label>
                {formData.image_url && (
                  <button
                    type="button"
                    onClick={handleImageDelete}
                    disabled={isUploadingImage}
                    className="absolute right-2 top-2 rounded-md bg-black/80 px-2 py-1 text-xs text-white opacity-0 transition-opacity hover:bg-black group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto"
                  >
                    Remove image
                  </button>
                )}
                {isUploadingImage && (
                  <div role="status" className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-black/90 p-2 text-xs text-white">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Uploading image…
                  </div>
                )}
              </div>

              <section className="profile-worksheet-card grid content-center gap-2.5" aria-label="Character details">
              <div className="mb-2 flex min-w-0 items-center gap-3">
                <span className="shrink-0 rounded-lg bg-[hsl(var(--brand-green-bg))] p-2.5 text-[hsl(var(--brand-green))]">
                  <Users className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <span className="block text-xs font-semibold text-[hsl(var(--brand-green))]">Character</span>
                  <h1 className="break-words font-serif text-2xl font-semibold leading-tight md:text-3xl">{formData.name || 'Unnamed Character'}</h1>
                </div>
              </div>
                {([
                  ['name', 'Name'],
                  ['nickname', 'Nickname'],
                  ['age', 'Age'],
                  ['gender', 'Gender'],
                ] as const).map(([field, label]) => (
                  <label key={field} className="profile-worksheet-detail">
                    <span>{label}</span>
                    <input
                      className="profile-worksheet-input"
                      name={field}
                      value={formData[field] ?? ''}
                      onChange={handleChange}
                    />
                  </label>
                ))}
              </section>
            </div>

            <div className="profile-worksheet-sections">
              {([
                ['appearance', 'Physical Description', 'Physical features, clothing, distinguishing marks…'],
                ['notes', 'Background & Notes', 'Backstory, secrets, and other details…'],
                ['goals', 'Goals & Motivations', 'What do they want? What drives them?'],
                ['relationships', 'Relationships', 'Family, friends, allies, and rivals…'],
                ['personality', 'Personality', 'Traits, habits, fears, and desires…'],
              ] as const).map(([field, label, placeholder]) => (
                <label key={field} className="profile-prose-section block">
                  <span className="profile-worksheet-heading">{label}</span>
                  <div className="reference-growing-field profile-prose-field" data-content={formData[field] ?? ''}>
                    <textarea
                      className="profile-worksheet-input"
                      name={field}
                      value={formData[field] ?? ''}
                      onChange={handleChange}
                      placeholder={placeholder}
                      rows={3}
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <section className="space-y-4">
            <h1 className="font-serif text-2xl font-semibold">{formData.name || 'Unnamed Character'}</h1>
            <VoiceIntelligenceTab characterId={entityId} />
          </section>
        )}
      </div>
    </div>
  )
}
