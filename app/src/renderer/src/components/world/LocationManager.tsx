import { useState } from 'react'
import { useEditorSave } from '../../hooks/useEditorSave'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { Camera, Save, Lock, Unlock, X, Loader2, MapPin } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import { uploadImage, deleteImage } from '../../services/storageService'

export default function LocationManager({ entityId }: { entityId: string }) {
  const { locations, updateLocation, panelState, toggleEntityLock, drafts } = useWorkspaceStore()
  const { addToast } = useToastStore()
  
  const location = locations.find(l => l.id === entityId)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Read from the in-memory draft (survives tab switches) or fall back to saved data
  const draft = drafts[entityId]
  const formData = draft ?? location ?? null

  const saving = useEditorSave(entityId, async (change: Record<string, unknown>) => {
    const original = useWorkspaceStore.getState().locations.find(item => item.id === entityId)
    const fields = ['name', 'description', 'culture', 'history', 'notes', 'image_url'] as const
    const changed = Object.fromEntries(fields.filter(field => change[field] !== original?.[field]).map(field => [field, change[field]]))
    if (original && !Object.keys(changed).length) return
    const updated = await window.api.locations.update({ id: entityId, ...changed })
    if (!updated) throw new Error('Record could not be found')
    updateLocation(updated)
  })
  const isSaving = saving.status === 'saving'

  if (!formData) return <div>Location not found</div>

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    saving.stage({ ...(useWorkspaceStore.getState().drafts[entityId] ?? location ?? {}), [name]: value })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { addToast('Image must be under 5MB', 'error'); return }

    setIsUploadingImage(true)
    try {
      const url = await uploadImage(file, 'locations', entityId)
      saving.stage({ ...(useWorkspaceStore.getState().drafts[entityId] ?? location ?? {}), image_url: url })
      addToast('Image uploaded', 'success')
    } catch (err: any) {
      addToast(err.message || 'Upload failed', 'error')
    } finally {
      setIsUploadingImage(false)
      e.target.value = ''
    }
  }

  const handleImageDelete = async () => {
    saving.stage({ ...(useWorkspaceStore.getState().drafts[entityId] ?? location ?? {}), image_url: '' })
    await deleteImage('locations', entityId, 'unknown').catch(() => {})
    addToast('Image removed', 'success')
  }

  const isDirty = !!drafts[entityId]

  return (
    <div className="reference-profile h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-7">
        <header className="reference-card flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
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
                  ? "bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))] border-current hover:brightness-95"
                  : "text-[hsl(var(--brand-green))] border-current hover:bg-[hsl(var(--brand-green-bg))]"
              )}
              title="Lock this location into AI context"
            >
              {panelState.lockedEntities?.includes(entityId) ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              <span className="text-sm">Memory Lock</span>
            </button>
            <button
              onClick={() => void saving.save()}
              disabled={isSaving}
              className="flex items-center gap-2 border border-transparent bg-[hsl(var(--brand-green-bg))] hover:brightness-95 disabled:opacity-50 text-[hsl(var(--brand-green))] px-4 py-2 rounded-md font-medium transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </header>

        <div className="profile-worksheet">
          <div className="profile-worksheet-intro">
            <div className="profile-worksheet-portrait group">
              <div className="absolute inset-0 flex items-center justify-center">
                {isUploadingImage ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-accent-400 animate-spin" />
                    <span className="text-xs text-surface-400">Uploading...</span>
                  </div>
                ) : formData.image_url ? (
                  <img src={formData.image_url} alt={formData.name} className="w-full h-full object-contain" />
                ) : (
                  <Camera className="w-12 h-12 text-surface-600" />
                )}
              </div>
              {!isUploadingImage && (
                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity rounded-lg gap-2">
                  <span className="text-white text-sm font-medium">Upload Image</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              )}
              {formData.image_url && !isUploadingImage && (
                <button
                  onClick={handleImageDelete}
                  className="absolute top-2 right-2 z-10 p-1 bg-red-600/80 hover:bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <section className="profile-worksheet-card grid content-center" aria-label="Location details">
              <div className="mb-2 flex min-w-0 items-center gap-3">
                <span className="shrink-0 rounded-lg bg-[hsl(var(--brand-green-bg))] p-2.5 text-[hsl(var(--brand-green))]">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <span className="block text-xs font-semibold text-[hsl(var(--brand-green))]">Location</span>
                  <h1 className="break-words font-serif text-2xl font-semibold leading-tight md:text-3xl">{formData.name || 'Unnamed Location'}</h1>
                </div>
              </div>
              <label className="profile-worksheet-detail">
                <span>Name</span>
                <input name="name" value={formData.name ?? ''} onChange={handleChange} className="profile-worksheet-input" />
              </label>
            </section>
          </div>

          <div className="profile-worksheet-sections">
            <div className="profile-prose-section">
              <label htmlFor={`location-description-${entityId}`} className="profile-worksheet-heading">Description & Geography</label>
              <div className="reference-growing-field profile-prose-field" data-content={formData.description ?? ''}>
                <textarea name="description" id={`location-description-${entityId}`} value={formData.description} onChange={handleChange} className="profile-worksheet-input" placeholder="What does it look like? Climate, terrain, architecture..." rows={2} />
              </div>
            </div>
            <div className="profile-prose-section">
              <label htmlFor={`location-culture-${entityId}`} className="profile-worksheet-heading">Culture & Society</label>
              <div className="reference-growing-field profile-prose-field" data-content={formData.culture ?? ''}>
                <textarea name="culture" id={`location-culture-${entityId}`} value={formData.culture} onChange={handleChange} className="profile-worksheet-input" placeholder="Customs, laws, economy, daily life..." rows={2} />
              </div>
            </div>
            <div className="profile-prose-section">
              <label htmlFor={`location-history-${entityId}`} className="profile-worksheet-heading">History</label>
              <div className="reference-growing-field profile-prose-field" data-content={formData.history ?? ''}>
                <textarea name="history" id={`location-history-${entityId}`} value={formData.history} onChange={handleChange} className="profile-worksheet-input" placeholder="Major events, founders, wars..." rows={2} />
              </div>
            </div>
            <div className="profile-prose-section">
              <label htmlFor={`location-notes-${entityId}`} className="profile-worksheet-heading">Other Notes</label>
              <div className="reference-growing-field profile-prose-field" data-content={formData.notes ?? ''}>
                <textarea name="notes" id={`location-notes-${entityId}`} value={formData.notes} onChange={handleChange} className="profile-worksheet-input" placeholder="Specific points of interest, secrets, atmosphere..." rows={2} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
