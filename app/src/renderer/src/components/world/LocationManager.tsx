import { useState } from 'react'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { Camera, Save, Lock, Unlock, X, Loader2 } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { cn } from '../../utils'
import { uploadImage, deleteImage } from '../../services/storageService'

export default function LocationManager({ entityId }: { entityId: string }) {
  const { locations, updateLocation, panelState, toggleEntityLock, drafts, setDraft, clearDraft } = useWorkspaceStore()
  const { addToast } = useToastStore()
  
  const location = locations.find(l => l.id === entityId)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  // Read from the in-memory draft (survives tab switches) or fall back to saved data
  const draft = drafts[entityId]
  const formData = draft ?? location ?? null

  if (!formData) return <div>Location not found</div>

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setDraft(entityId, { ...(drafts[entityId] ?? location ?? {}), [name]: value })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { addToast('Image must be under 5MB', 'error'); return }

    setIsUploadingImage(true)
    try {
      const url = await uploadImage(file, 'locations', entityId)
      setDraft(entityId, { ...(drafts[entityId] ?? location ?? {}), image_url: url })
      addToast('Image uploaded', 'success')
    } catch (err: any) {
      addToast(err.message || 'Upload failed', 'error')
    } finally {
      setIsUploadingImage(false)
      e.target.value = ''
    }
  }

  const handleImageDelete = async () => {
    setDraft(entityId, { ...(drafts[entityId] ?? location ?? {}), image_url: '' })
    await deleteImage('locations', entityId, 'unknown').catch(() => {})
    addToast('Image removed', 'success')
  }

  const handleSave = async () => {
    if (!formData) return
    setIsSaving(true)
    try {
      const updated = await window.api.locations.update(formData)
      updateLocation(updated as any)
      clearDraft(entityId)
      addToast('Location saved', 'success')
    } catch {
      addToast('Failed to save location', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const isDirty = !!drafts[entityId]

  return (
    <div className="p-8 max-w-4xl mx-auto overflow-y-auto h-full text-surface-200">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-surface-100">{formData.name || 'Unnamed Location'}</h1>
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
            title="Lock this location into AI context"
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

      <div className="grid grid-cols-3 gap-8">
        {/* Left Column: Image & Basic Info */}
        <div className="col-span-1 space-y-6">
          <div className="relative group">
            <div className="aspect-[4/3] bg-surface-800 rounded-lg overflow-hidden border border-surface-700 flex items-center justify-center">
              {isUploadingImage ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-accent-400 animate-spin" />
                  <span className="text-xs text-surface-400">Uploading...</span>
                </div>
              ) : formData.image_url ? (
                <img src={formData.image_url} alt={formData.name} className="w-full h-full object-cover" />
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

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Name</label>
              <input name="name" value={formData.name} onChange={handleChange} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500" />
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Info */}
        <div className="col-span-2 space-y-6">
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Description & Geography</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500 resize-none" placeholder="What does it look like? Climate, terrain, architecture..."></textarea>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Culture & Society</label>
            <textarea name="culture" value={formData.culture} onChange={handleChange} rows={3} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500 resize-none" placeholder="Customs, laws, economy, daily life..."></textarea>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">History</label>
            <textarea name="history" value={formData.history} onChange={handleChange} rows={4} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500 resize-none" placeholder="Major events, founders, wars..."></textarea>
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Other Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4} className="w-full bg-surface-800 border border-surface-700 rounded p-2 text-sm focus:outline-none focus:border-accent-500 resize-none" placeholder="Specific points of interest, secrets, atmosphere..."></textarea>
          </div>
        </div>
      </div>
    </div>
  )
}
