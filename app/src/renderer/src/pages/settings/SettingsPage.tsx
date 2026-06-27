import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../../stores/userStore'
import { useToastStore } from '../../stores/toastStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { Settings, Key, Palette, Bot, Loader2, ArrowLeft, Download, Book, Puzzle, Cloud, UploadCloud, DownloadCloud } from 'lucide-react'
import ExportModal from '../../components/books/ExportModal'
import { useEffect } from 'react'

export interface PluginInfo {
  id: string
  name: string
  description: string
  version: string
  code: string
  enabled: boolean
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, settings, setSettings } = useUserStore()
  const { books } = useWorkspaceStore()
  const { addToast } = useToastStore()

  const [aiProvider, setAiProvider] = useState(settings?.ai_provider || 'openai')
  const [aiApiKey, setAiApiKey] = useState(settings?.ai_api_key || '')
  const [aiStylePrompt, setAiStylePrompt] = useState(settings?.ai_style_prompt || '')
  const [preserveFormatting, setPreserveFormatting] = useState(settings?.preserve_formatting ?? true)

  useEffect(() => {
    if (settings) {
      setAiProvider(settings.ai_provider || 'openai')
      setAiApiKey(settings.ai_api_key || '')
      setAiStylePrompt(settings.ai_style_prompt || '')
      setPreserveFormatting(settings.preserve_formatting ?? true)
    }
  }, [settings])
  const [isSaving, setIsSaving] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [selectedBookId, setSelectedBookId] = useState(books.length > 0 ? books[0].id : '')
  const [plugins, setPlugins] = useState<PluginInfo[]>([])

  useEffect(() => {
    window.api.plugins.getAll().then(setPlugins)
  }, [])

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    try {
      const updated = await window.api.settings.update({
        userId: user.id,
        aiProvider,
        aiApiKey,
        aiStylePrompt,
        preserveFormatting,
        editorFont: settings?.editor_font || 'Georgia',
        fontSize: settings?.font_size || 16,
        lineSpacing: settings?.line_spacing || 1.8,
      })
      setSettings(updated as never)
      
      // Sync to cloud in background
      import('../../services/syncService').then(({ syncService }) => {
        syncService.syncSettingsToCloud(updated as any).catch(e => console.error('Cloud sync failed', e))
      })

      addToast('Settings saved', 'success')
    } catch {
      addToast('Failed to save settings', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-surface-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-8 py-10 space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-50 flex items-center gap-2">
              <Settings className="w-6 h-6 text-surface-400" />
              Settings
            </h1>
            <p className="text-surface-500 text-sm mt-1">Configure your writing environment and AI preferences.</p>
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-800 hover:bg-surface-700 text-surface-200 text-sm font-medium rounded-lg transition-colors border border-surface-700 hover:border-surface-600"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* AI Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider flex items-center gap-2">
            <Bot className="w-4 h-4 text-accent-400" />
            AI Configuration
          </h2>
          <div className="space-y-3 glass-card rounded-xl p-5">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5">AI Provider</label>
              <select
                id="settings-ai-provider"
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 text-sm focus:outline-none focus:border-accent-500 transition-all"
              >
                <option value="openai">OpenAI (GPT-4o-mini)</option>
                <option value="gemini">Google Gemini</option>
                <option value="claude">Anthropic Claude</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5" />
                API Key
              </label>
              <input
                id="settings-api-key"
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={`Your ${aiProvider} API key...`}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all font-mono"
              />
              <p className="text-[11px] text-surface-600 mt-1">Your API key is stored locally and never shared.</p>
            </div>
            
            <div className="pt-2 border-t border-surface-800">
              <label className="block text-sm font-medium text-surface-300 mb-1.5">AI Style Profile</label>
              <textarea
                value={aiStylePrompt}
                onChange={(e) => setAiStylePrompt(e.target.value)}
                placeholder="e.g. Write in a fast-paced, gritty tone. Use short sentences. Focus on sensory details."
                rows={8}
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 placeholder-surface-500 text-sm focus:outline-none focus:border-accent-500 transition-all resize-y min-h-[160px]"
              />
              <p className="text-[11px] text-surface-600 mt-1">Custom instructions for how the AI should rewrite your text.</p>
            </div>

            <div className="pt-2 border-t border-surface-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!preserveFormatting}
                  onChange={(e) => setPreserveFormatting(e.target.checked)}
                  className="w-4 h-4 rounded bg-surface-800 border-surface-700 text-accent-500 focus:ring-accent-500 focus:ring-offset-surface-900"
                />
                <span className="text-sm font-medium text-surface-300">Preserve Formatting</span>
              </label>
              <p className="text-[11px] text-surface-600 mt-1 ml-6">When enabled, the AI will attempt to retain bold, italics, and headers during rewrites.</p>
            </div>
          </div>
        </section>

        {/* Plugins Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-accent-400" />
            Plugins
          </h2>
          <div className="space-y-3 glass-card rounded-xl p-5">
            <p className="text-[13px] text-surface-400 mb-2">Extend functionality with custom plugins loaded from your local plugins directory.</p>
            {plugins.length === 0 ? (
              <p className="text-sm text-surface-500 py-2 italic">No plugins found. Add .js files to your plugins folder.</p>
            ) : (
              <ul className="space-y-2">
                {plugins.map(p => (
                  <li key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800 border border-surface-700">
                    <div>
                      <h3 className="text-sm font-medium text-surface-100">{p.name}</h3>
                      <p className="text-[11px] text-surface-400">{p.description} (v{p.version})</p>
                    </div>
                    <button 
                      onClick={async () => {
                        await window.api.plugins.delete(p.id)
                        setPlugins(await window.api.plugins.getAll())
                      }}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md text-xs font-medium transition-colors"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Export Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider flex items-center gap-2">
            <Download className="w-4 h-4 text-accent-400" />
            Export Manuscript
          </h2>
          <div className="space-y-3 glass-card rounded-xl p-5">
            <p className="text-[13px] text-surface-400 mb-2">Select a book from your workspace to generate a publication-ready file in PDF, DOCX, EPUB, or Markdown.</p>
            
            {books.length === 0 ? (
              <p className="text-sm text-surface-500 py-2">No books available to export. Create a book first.</p>
            ) : (
              <div className="flex gap-3">
                <select
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="flex-1 px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 text-sm focus:outline-none focus:border-accent-500 transition-all"
                >
                  {books.map(b => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsExportOpen(true)}
                  disabled={!selectedBookId}
                  className="px-4 py-2 bg-surface-700 hover:bg-surface-600 disabled:opacity-50 text-surface-100 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-surface-600"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Cloud Backup Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-surface-300 uppercase tracking-wider flex items-center gap-2">
            <Cloud className="w-4 h-4 text-accent-400" />
            Cloud Backup & Restore
          </h2>
          <div className="space-y-4 glass-card rounded-xl p-5">
            <p className="text-[13px] text-surface-400">
              Securely back up your entire local database to your Supabase `user_backups` bucket. 
              The system also auto-backs up every 5 minutes in the background.
            </p>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  setIsBackingUp(true)
                  try {
                    const { syncService } = await import('../../services/syncService')
                    const result = await syncService.backupDatabaseToCloud()
                    if (result.success) {
                      addToast('Database backed up to cloud', 'success')
                    } else {
                      addToast(result.error || 'Backup failed', 'error')
                    }
                  } finally {
                    setIsBackingUp(false)
                  }
                }}
                disabled={isBackingUp || isRestoring}
                className="flex-1 px-4 py-2.5 bg-surface-800 hover:bg-surface-700 disabled:opacity-50 text-surface-100 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-surface-700"
              >
                {isBackingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {isBackingUp ? 'Backing Up...' : 'Backup Now'}
              </button>

              <button
                onClick={async () => {
                  if (!confirm('Are you sure? This will OVERWRITE your current local database with the cloud backup. All unsynced local changes will be lost.')) return
                  setIsRestoring(true)
                  try {
                    const { syncService } = await import('../../services/syncService')
                    const result = await syncService.restoreDatabaseFromCloud()
                    if (result.success) {
                      addToast('Database restored! Reloading...', 'success')
                      setTimeout(() => window.location.reload(), 1500)
                    } else {
                      addToast(result.error || 'Restore failed', 'error')
                    }
                  } finally {
                    setIsRestoring(false)
                  }
                }}
                disabled={isBackingUp || isRestoring}
                className="flex-1 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isRestoring ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                {isRestoring ? 'Restoring...' : 'Restore from Cloud'}
              </button>
            </div>
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end">
          <button
            id="settings-save"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-accent-600 hover:bg-accent-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
      
      {selectedBookId && (
        <ExportModal 
          isOpen={isExportOpen} 
          onClose={() => setIsExportOpen(false)} 
          bookId={selectedBookId} 
          bookTitle={books.find(b => b.id === selectedBookId)?.title || ''} 
          initialAuthorName={books.find(b => b.id === selectedBookId)?.authorName || ''}
        />
      )}
    </div>
  )
}
