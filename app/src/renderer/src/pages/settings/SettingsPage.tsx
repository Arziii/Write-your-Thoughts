import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../../stores/userStore'
import { useToastStore } from '../../stores/toastStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import {
  Settings, Key, Palette, Bot, Loader2, ArrowLeft, Download,
  Puzzle, Cloud, UploadCloud, DownloadCloud, User, ChevronDown, Volume2
} from 'lucide-react'
import ExportModal from '../../components/export/ExportModal'
import { authService } from '../../services/authService'
import { ProviderSettings, AIProvider } from '../../types'
import { ProviderFactory } from '../../services/ai/ProviderFactory'
import { isLocalAIProvider, resolveAISettings } from '../../services/ai/configuration'
import ReadAloudSettings from './ReadAloudSettings'
import { Button, Input, SectionCard, Select, Switch, Textarea } from '../../components/ui/primitives'
import { cn } from '../../utils'

export interface PluginInfo {
  id: string
  name: string
  description: string
  version: string
  code: string
  enabled: boolean
}

type SettingsCategory = 'profile' | 'appearance' | 'ai' | 'read-aloud' | 'cloud' | 'export' | 'plugins'

const categories: ReadonlyArray<{ id: SettingsCategory; label: string; Icon: typeof User }> = [
  { id: 'profile', label: 'Profile', Icon: User },
  { id: 'appearance', label: 'Appearance', Icon: Palette },
  { id: 'ai', label: 'AI & Models', Icon: Bot },
  { id: 'read-aloud', label: 'Read Aloud', Icon: Volume2 },
  { id: 'cloud', label: 'Cloud Sync & Backup', Icon: Cloud },
  { id: 'export', label: 'Export Book', Icon: Download },
  { id: 'plugins', label: 'Plugins', Icon: Puzzle },
]

const getDraft = () => {
  const draftStr = sessionStorage.getItem('settings_draft')
  if (draftStr) {
    try { return JSON.parse(draftStr) } catch {}
  }
  return null
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, settings, setSettings } = useUserStore()
  const { books } = useWorkspaceStore()
  const { addToast } = useToastStore()

  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('profile')
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })
  const [availableModels, setAvailableModels] = useState<string[]>([])

  const draft = getDraft()
  const [theme, setTheme] = useState<'light' | 'dark'>(settings?.theme ?? 'light')
  const [displayName, setDisplayName] = useState(draft?.displayName ?? user?.user_metadata?.display_name ?? '')
  const [aiProvider, setAiProvider] = useState<AIProvider>(draft?.aiProvider ?? (settings?.ai_provider as AIProvider) ?? 'openai')
  const [aiApiKey, setAiApiKey] = useState(draft?.aiApiKey ?? settings?.ai_api_key ?? '')
  const [aiSettingsObj, setAiSettingsObj] = useState<Record<string, ProviderSettings>>(draft?.aiSettingsObj ?? settings?.ai_settings ?? {})
  const [aiStylePrompt, setAiStylePrompt] = useState(draft?.aiStylePrompt ?? settings?.ai_style_prompt ?? '')
  const [preserveFormatting, setPreserveFormatting] = useState(draft?.preserveFormatting ?? settings?.preserve_formatting ?? true)

  const updateProviderSetting = (key: keyof ProviderSettings, value: string | number | undefined | Record<string, string>) => {
    setAiSettingsObj(prev => ({
      ...prev,
      [aiProvider]: {
        ...prev[aiProvider],
        [key]: value
      }
    }))
  }

  const currentProviderSettings = aiSettingsObj[aiProvider] || {}
  const localAI = isLocalAIProvider(aiProvider, currentProviderSettings.baseUrl)

  useEffect(() => {
    const d = getDraft()
    if (settings) {
      setTheme(settings.theme ?? 'light')
      setAiProvider(d?.aiProvider ?? (settings.ai_provider as AIProvider) ?? 'openai')
      setAiApiKey(d?.aiApiKey ?? settings.ai_api_key ?? '')
      setAiSettingsObj(d?.aiSettingsObj ?? settings.ai_settings ?? {})
      setAiStylePrompt(d?.aiStylePrompt ?? settings.ai_style_prompt ?? '')
      setPreserveFormatting(d?.preserveFormatting ?? settings.preserve_formatting ?? true)
    }
    if (user) {
      setDisplayName(d?.displayName ?? user.user_metadata?.display_name ?? '')
    }
  }, [settings, user])

  useEffect(() => {
    const draftObj = { aiProvider, aiApiKey, aiSettingsObj, aiStylePrompt, preserveFormatting, displayName }
    sessionStorage.setItem('settings_draft', JSON.stringify(draftObj))
  }, [aiProvider, aiApiKey, aiSettingsObj, aiStylePrompt, preserveFormatting, displayName])

  const [isSaving, setIsSaving] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [selectedBookId, setSelectedBookId] = useState(books.length > 0 ? books[0].id : '')
  const [plugins, setPlugins] = useState<PluginInfo[]>([])

  useEffect(() => {
    window.api.plugins.getAll().then(setPlugins)
  }, [])

  const isDirty = Boolean(
    displayName !== (user?.user_metadata?.display_name ?? '') ||
    aiProvider !== ((settings?.ai_provider as AIProvider) ?? 'openai') ||
    aiApiKey !== (settings?.ai_api_key ?? '') ||
    aiStylePrompt !== (settings?.ai_style_prompt ?? '') ||
    Boolean(preserveFormatting) !== Boolean(settings?.preserve_formatting ?? true) ||
    JSON.stringify(aiSettingsObj) !== JSON.stringify(settings?.ai_settings ?? {})
  )

  const handleSave = async () => {
    if (!user) return
    setIsSaving(true)
    try {
      const updated = await window.api.settings.update({
        userId: user.id,
        theme,
        aiProvider,
        aiApiKey: localAI ? undefined : currentProviderSettings.apiKey || aiApiKey,
        aiSettings: JSON.stringify(aiSettingsObj),
        aiStylePrompt,
        preserveFormatting,
        editorFont: settings?.editor_font || 'Georgia',
        fontSize: settings?.font_size || 16,
        lineSpacing: settings?.line_spacing || 1.8,
      })

      sessionStorage.removeItem('settings_draft')
      setSettings(updated as never)

      import('../../services/syncService').then(({ syncService }) => {
        syncService.syncSettingsToCloud(updated as any).catch(e => console.error('Cloud sync failed', e))
      })

      addToast(navigator.onLine ? 'Settings saved' : 'Settings saved on this device', 'success')
      if (displayName !== (user.user_metadata?.display_name || '')) {
        if (!navigator.onLine) {
          addToast('Connect to the internet to update your account name.', 'info')
        } else {
          try {
            await authService.updateProfile(displayName)
            useUserStore.getState().setLocalUser(await window.api.auth.getStoredUser(user.id))
          } catch {
            addToast('Could not update your account name.', 'warning')
          }
        }
      }
    } catch {
      addToast('Failed to save settings', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleThemeInstant = async (nextChecked: boolean) => {
    const newTheme = nextChecked ? 'dark' : 'light'
    setTheme(newTheme)

    if (user) {
      const currentSettings = settings || {
        theme: 'light',
        ai_provider: 'openai',
        ai_api_key: '',
        ai_style_prompt: '',
        preserve_formatting: true,
        editor_font: 'Georgia',
        font_size: 16,
        line_spacing: 1.8,
      }
      setSettings({ ...currentSettings, theme: newTheme } as never)
      try {
        const updated = await window.api.settings.update({ userId: user.id, theme: newTheme })
        setSettings(updated as never)
        import('../../services/syncService').then(({ syncService }) => {
          syncService.syncSettingsToCloud(updated as any).catch(e => console.error('Cloud sync failed', e))
        })
      } catch (e) {
        console.error('Failed to save theme instantly', e)
      }
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[hsl(var(--studio-desk))]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Top header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-header))] px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="flex items-center gap-2 font-serif text-xl font-bold text-surface-50">
              <Settings className="h-5 w-5 text-[hsl(var(--brand-green))]" />
              Settings
            </h1>
            <p className="text-xs text-surface-400">Configure your writing environment, AI providers, audio, and backups.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="text-xs font-medium text-warning-400">Unsaved changes</span>
          )}
          <Button id="settings-save" variant="primary" size="md" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </header>

      {/* Split Category Navigation + Content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <nav aria-label="Settings categories" className="w-56 shrink-0 overflow-y-auto border-r border-[hsl(var(--studio-edge))] bg-surface-900 p-3 space-y-1">
          {categories.map(({ id, label, Icon }) => {
            const active = activeCategory === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveCategory(id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                  active
                    ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))] font-semibold'
                    : 'text-surface-400 hover:bg-surface-850 hover:text-surface-100'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </button>
            )
          })}
        </nav>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          <div className="mx-auto max-w-2xl space-y-6">
            {activeCategory === 'profile' && (
              <SectionCard title="Account Profile" description="Used on your dashboard and across your books." icon={User}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-200">Display Name</label>
                    <Input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter your pen name"
                    />
                  </div>
                  {user?.email && (
                    <p className="text-xs text-surface-400">Signed in as <span className="font-medium text-surface-200">{user.email}</span></p>
                  )}
                </div>
              </SectionCard>
            )}

            {activeCategory === 'appearance' && (
              <SectionCard title="Appearance" description="Theme changes apply and save immediately." icon={Palette}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-surface-100">Dark Mode</p>
                    <p className="mt-0.5 text-xs text-surface-400">Switch between warm parchment light and charcoal studio dark.</p>
                  </div>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleThemeInstant}
                    aria-label="Toggle Dark Mode"
                  />
                </div>
              </SectionCard>
            )}

            {activeCategory === 'read-aloud' && <ReadAloudSettings />}

            {activeCategory === 'ai' && (
              <SectionCard title="AI & Models" description="Choose a hosted or local AI provider for polishing, brainstorming, and analysis." icon={Bot}>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-200">AI Provider</label>
                    <Select
                      id="settings-ai-provider"
                      value={aiProvider}
                      onChange={(e) => {
                        setAiProvider(e.target.value as AIProvider)
                        setConnectionStatus({ type: 'idle', message: '' })
                        setAvailableModels([])
                      }}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="claude">Anthropic Claude</option>
                      <option value="groq">Groq</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="mistral">Mistral AI</option>
                      <option value="together">Together AI</option>
                      <option value="xai">xAI (Grok)</option>
                      <option value="ollama">Ollama (Local)</option>
                      <option value="lmstudio">LM Studio (Local)</option>
                      <option value="custom">Custom OpenAI-Compatible</option>
                    </Select>
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-200">
                      <Key className="h-3.5 w-3.5" />
                      API Key {localAI && '(Optional)'}
                    </label>
                    <Input
                      id="settings-api-key"
                      type="password"
                      className="font-mono"
                      value={currentProviderSettings.apiKey || ''}
                      onChange={(e) => updateProviderSetting('apiKey', e.target.value)}
                      placeholder={localAI ? 'Leave blank for a default local server' : (!currentProviderSettings.apiKey && aiApiKey) ? '••••••••••••••••••••••••••••••••••••••••••••••••' : `Your ${aiProvider} API key...`}
                    />
                    {localAI && <p className="mt-1 text-xs text-surface-400">Start the local server and download a model. It can then run while you’re offline.</p>}
                  </div>

                  <Button
                    variant="secondary"
                    size="md"
                    className="w-full"
                    disabled={isTestingConnection}
                    onClick={async () => {
                      setIsTestingConnection(true)
                      setConnectionStatus({ type: 'idle', message: '' })
                      try {
                        const settingsToUse = resolveAISettings(aiProvider, aiApiKey, aiSettingsObj)
                        const providerInstance = ProviderFactory.create(aiProvider, settingsToUse)
                        if (!localAI && !await providerInstance.testConnection()) throw new Error('Failed to connect.')

                        const fetchedModels = await providerInstance.getAvailableModels()
                        setAvailableModels(fetchedModels)
                        if (localAI && fetchedModels.length === 0) throw new Error('The local server is running. Download or load a model first.')
                        if (localAI && settingsToUse.model && !fetchedModels.includes(settingsToUse.model)) {
                          setIsAdvancedOpen(true)
                          throw new Error('The selected model is unavailable. Choose an installed model under Advanced Settings.')
                        }

                        let modelToUse = settingsToUse.model
                        if (!modelToUse) {
                          modelToUse = providerInstance.getRecommendedModel(fetchedModels)
                          updateProviderSetting('model', modelToUse)
                        }
                        if (!modelToUse) {
                          if (fetchedModels.length === 0) {
                            setConnectionStatus({ type: 'error', message: 'No models found. Please enter a Model in Advanced Settings.' })
                            return
                          }
                          modelToUse = fetchedModels[0]
                          updateProviderSetting('model', modelToUse)
                        }
                        if (!localAI && settingsToUse.apiKey && !aiApiKey) setAiApiKey(settingsToUse.apiKey)

                        setConnectionStatus({ type: 'success', message: `Connected successfully\nUsing: ${modelToUse}\nReady to use.` })
                        addToast('Connection successful!', 'success')
                      } catch (e: any) {
                        setConnectionStatus({ type: 'error', message: e.message || 'Connection failed' })
                        addToast(e.message || 'Connection failed', 'error')
                      } finally {
                        setIsTestingConnection(false)
                      }
                    }}
                  >
                    {isTestingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                    {isTestingConnection ? 'Testing…' : 'Test Connection'}
                  </Button>

                  {connectionStatus.type !== 'idle' && (
                    <div className={cn(
                      'rounded-lg border p-3.5 text-sm whitespace-pre-wrap selectable',
                      connectionStatus.type === 'success'
                        ? 'border-[hsl(var(--brand-green)/0.3)] bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
                        : 'border-danger-500/25 bg-danger-500/10 text-danger-500'
                    )}>
                      {connectionStatus.message}
                    </div>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                      className="text-xs font-semibold uppercase tracking-wider text-surface-400 hover:text-surface-100"
                    >
                      {isAdvancedOpen ? '▼ Hide Advanced Settings' : '▶ Show Advanced Settings'}
                    </button>

                    {isAdvancedOpen && (
                      <div className="mt-3 space-y-4 rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-950 p-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-medium text-surface-300">Model Override</label>
                          <div className="relative">
                            <Input
                              type="text"
                              value={currentProviderSettings.model || ''}
                              onChange={(e) => {
                                updateProviderSetting('model', e.target.value)
                                if (!isModelDropdownOpen) setIsModelDropdownOpen(true)
                              }}
                              onFocus={() => setIsModelDropdownOpen(true)}
                              onBlur={() => setTimeout(() => setIsModelDropdownOpen(false), 200)}
                              placeholder="Leave blank for automatic detection"
                              className="pr-8"
                            />
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                              <ChevronDown className="h-4 w-4 text-surface-400" />
                            </div>
                            {isModelDropdownOpen && availableModels.length > 0 && (
                              <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-[hsl(var(--studio-edge))] bg-[hsl(var(--studio-paper))] shadow-xl">
                                {availableModels
                                  .filter(m => m.toLowerCase().includes((currentProviderSettings.model || '').toLowerCase()))
                                  .map(model => (
                                    <li
                                      key={model}
                                      className="cursor-pointer px-3 py-2 text-sm text-surface-100 hover:bg-[hsl(var(--brand-green-bg))] hover:text-[hsl(var(--brand-green))]"
                                      onClick={() => {
                                        updateProviderSetting('model', model)
                                        setIsModelDropdownOpen(false)
                                      }}
                                    >
                                      {model}
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {['ollama', 'lmstudio', 'custom'].includes(aiProvider) && (
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-300">Base URL</label>
                            <Input
                              type="text"
                              value={currentProviderSettings.baseUrl || ''}
                              onChange={(e) => updateProviderSetting('baseUrl', e.target.value)}
                              placeholder={
                                aiProvider === 'ollama' ? 'http://localhost:11434/v1' :
                                aiProvider === 'lmstudio' ? 'http://localhost:1234/v1' :
                                'https://api.yourprovider.com/v1'
                              }
                            />
                          </div>
                        )}

                        {aiProvider === 'openrouter' && (
                          <>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-surface-300">HTTP Referer (Optional)</label>
                              <Input
                                type="text"
                                value={currentProviderSettings.customHeaders?.referer || ''}
                                onChange={(e) => updateProviderSetting('customHeaders', { ...currentProviderSettings.customHeaders, referer: e.target.value })}
                                placeholder="https://yourwebsite.com"
                              />
                            </div>
                            <div>
                              <label className="mb-1.5 block text-xs font-medium text-surface-300">App Name (Optional)</label>
                              <Input
                                type="text"
                                value={currentProviderSettings.customHeaders?.appName || ''}
                                onChange={(e) => updateProviderSetting('customHeaders', { ...currentProviderSettings.customHeaders, appName: e.target.value })}
                                placeholder="Write Your Thoughts"
                              />
                            </div>
                          </>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-300">Temperature</label>
                            <Input type="number" min="0" max="2" step="0.1"
                              value={currentProviderSettings.temperature ?? ''}
                              onChange={(e) => updateProviderSetting('temperature', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                              placeholder="0.7" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-300">Top P</label>
                            <Input type="number" min="0" max="1" step="0.05"
                              value={currentProviderSettings.topP ?? ''}
                              onChange={(e) => updateProviderSetting('topP', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                              placeholder="1.0" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-300">Max Tokens</label>
                            <Input type="number" min="1" step="1"
                              value={currentProviderSettings.maxTokens ?? ''}
                              onChange={(e) => updateProviderSetting('maxTokens', e.target.value === '' ? undefined : parseInt(e.target.value))}
                              placeholder="Auto" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-300">Timeout (ms)</label>
                            <Input type="number" min="1000" step="1000"
                              value={currentProviderSettings.timeout ?? ''}
                              onChange={(e) => updateProviderSetting('timeout', e.target.value === '' ? undefined : parseInt(e.target.value))}
                              placeholder="Auto" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-[hsl(var(--studio-edge))] pt-4">
                    <label className="mb-1.5 block text-sm font-medium text-surface-200">AI Style Profile</label>
                    <Textarea
                      value={aiStylePrompt}
                      onChange={(e) => setAiStylePrompt(e.target.value)}
                      placeholder="e.g. Write in a fast-paced, gritty tone. Use short sentences. Focus on sensory details."
                      rows={6}
                      className="min-h-[130px] resize-y"
                    />
                    <p className="mt-1 text-xs text-surface-400">Custom instructions for how the AI should rewrite your text.</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-[hsl(var(--studio-edge))] pt-4">
                    <div>
                      <p className="text-sm font-medium text-surface-200">Preserve Formatting</p>
                      <p className="mt-0.5 text-xs text-surface-400">Retain bold, italics, and headers during AI rewrites.</p>
                    </div>
                    <Switch
                      checked={Boolean(preserveFormatting)}
                      onCheckedChange={setPreserveFormatting}
                      aria-label="Preserve Formatting"
                    />
                  </div>
                </div>
              </SectionCard>
            )}

            {activeCategory === 'cloud' && (
              <SectionCard
                title="Cloud Backup & Restore"
                description="Your data automatically syncs in real-time. Use snapshots for emergency disaster recovery."
                icon={Cloud}
              >
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    size="md"
                    className="flex-1"
                    disabled={isBackingUp || isRestoring}
                    onClick={async () => {
                      setIsBackingUp(true)
                      try {
                        const { syncService } = await import('../../services/syncService')
                        const result = await syncService.backupDatabaseToCloud()
                        if (result.success) addToast('Database backed up to cloud', 'success')
                        else addToast(result.error || 'Backup failed', 'error')
                      } finally {
                        setIsBackingUp(false)
                      }
                    }}
                  >
                    {isBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {isBackingUp ? 'Backing Up…' : 'Emergency Snapshot'}
                  </Button>

                  <Button
                    variant="danger"
                    size="md"
                    className="flex-1"
                    disabled={isBackingUp || isRestoring}
                    onClick={async () => {
                      if (!confirm('Are you sure? This will OVERWRITE your current local database with the cloud backup. All unsynced local changes will be lost.')) return
                      setIsRestoring(true)
                      try {
                        const { syncService } = await import('../../services/syncService')
                        const result = await syncService.restoreDatabaseFromCloud()
                        if (result.success) {
                          addToast('Database restored! Reloading…', 'success')
                          setTimeout(() => window.location.reload(), 1500)
                        } else {
                          addToast(result.error || 'Restore failed', 'error')
                        }
                      } finally {
                        setIsRestoring(false)
                      }
                    }}
                  >
                    {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
                    {isRestoring ? 'Restoring…' : 'Restore from Cloud'}
                  </Button>
                </div>
              </SectionCard>
            )}

            {activeCategory === 'export' && (
              <SectionCard
                title="Export Manuscript"
                description="Generate publication-ready PDF, DOCX, EPUB, Markdown, or Kokoro Audiobook files."
                icon={Download}
              >
                {books.length === 0 ? (
                  <p className="text-sm text-surface-400">No books available to export. Create a book first.</p>
                ) : (
                  <div className="flex gap-3">
                    <Select value={selectedBookId} onChange={(e) => setSelectedBookId(e.target.value)} className="flex-1">
                      {books.map(b => (
                        <option key={b.id} value={b.id}>{b.title}</option>
                      ))}
                    </Select>
                    <Button variant="primary" size="md" onClick={() => setIsExportOpen(true)} disabled={!selectedBookId}>
                      <Download className="h-4 w-4" />
                      Export
                    </Button>
                  </div>
                )}
              </SectionCard>
            )}

            {activeCategory === 'plugins' && (
              <SectionCard title="Plugins" description="Custom plugins loaded from your local plugins directory." icon={Puzzle}>
                {plugins.length === 0 ? (
                  <p className="text-sm italic text-surface-400">No plugins found. Add .js files to your plugins folder.</p>
                ) : (
                  <ul className="space-y-2">
                    {plugins.map(p => (
                      <li key={p.id} className="flex items-center justify-between rounded-lg border border-[hsl(var(--studio-edge))] bg-surface-950 p-3">
                        <div>
                          <h3 className="text-sm font-medium text-surface-100">{p.name}</h3>
                          <p className="text-xs text-surface-400">{p.description} (v{p.version})</p>
                        </div>
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={async () => {
                            await window.api.plugins.delete(p.id)
                            setPlugins(await window.api.plugins.getAll())
                          }}
                        >
                          Delete
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            )}
          </div>
        </div>
      </div>

      {selectedBookId && (
        <ExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          book={books.find(b => b.id === selectedBookId)!}
        />
      )}
    </div>
  )
}
