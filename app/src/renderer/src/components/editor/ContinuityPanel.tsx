import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useUserStore } from '../../stores/userStore'
import { Plus, Trash2, Shield, AlertTriangle, BookOpen, CheckCircle, ChevronDown } from 'lucide-react'
import { useToastStore } from '../../stores/toastStore'
import { aiService } from '../../services/aiService'
import type { ContinuityWarning } from '../../types'
import { cn } from '../../utils'
import { EditorToolPanel, PanelAnalyzeButton, PanelEmptyState, panelButton, panelCard, panelField, panelIconButton } from './EditorToolPanel'


function EntryComposer({ label, placeholder, onAdd }: {
  label: string
  placeholder: string
  onAdd: (description: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const addToast = useToastStore(state => state.addToast)

  if (!expanded) {
    return (
      <button type="button" className={panelButton} onClick={() => setExpanded(true)}>
        <Plus className="h-3.5 w-3.5" aria-hidden="true" /> {label}
      </button>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!value.trim() || saving) return
    setSaving(true)
    try {
      await onAdd(value.trim())
      setValue('')
      setExpanded(false)
    } catch {
      addToast(`${label} failed. Try again.`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className={cn(panelCard, "w-full")}>
      <textarea autoFocus rows={2} aria-label={label} value={value} placeholder={placeholder} disabled={saving}
        onChange={event => setValue(event.target.value)}
        className={cn(panelField, "resize-y")} />
      <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
        <button type="button" className="px-2 text-xs text-surface-400 hover:text-surface-100" disabled={saving}
          onClick={() => { setValue(''); setExpanded(false) }}>Cancel</button>
        <button type="submit" className={panelButton} disabled={saving || !value.trim()}>{saving ? 'Adding…' : label}</button>
      </div>
    </form>
  )
}

export default function ContinuityPanel({ chapterId, onClose }: { chapterId: string; onClose: () => void }) {
  const { 
    continuityEvents, setContinuityEvents, addContinuityEvent, removeContinuityEvent,
    continuityWarnings, setContinuityWarnings, addContinuityWarning, resolveContinuityWarning, removeContinuityWarning,
    storyBible, verseTimelineEvents
  } = useStoryBibleStore()
  
  const { chapters } = useWorkspaceStore()
  const { settings } = useUserStore()
  const { addToast } = useToastStore()

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      try {
        const [events, warnings] = await Promise.all([
          window.api.continuityEvents.getByChapter(chapterId),
          window.api.continuityWarnings.getByChapter(chapterId),
        ])
        if (cancelled) return
        setContinuityEvents(chapterId, events)
        setContinuityWarnings(chapterId, warnings)
        setLoadState('loaded')
      } catch (e) {
        console.error('Failed to load continuity data', e)
        if (!cancelled) setLoadState('error')
      }
    }
    void loadData()
    return () => { cancelled = true }
  }, [chapterId])

  const activeChapter = chapters.find(c => c.id === chapterId)

  const handleAnalyzeContinuity = async () => {
    if (!settings?.ai_api_key) {
      addToast('Please set your AI API Key in Settings first', 'error')
      return
    }
    if (!activeChapter?.content) {
      addToast('Chapter is empty.', 'error')
      return
    }

    setIsAnalyzing(true)
    try {
      let contextStr = storyBible?.premise || 'No context'
      if (verseTimelineEvents.length > 0) {
        contextStr += '\n\nVERSE TIMELINE RECORD (Global World Events):\n' + [...verseTimelineEvents].sort((a,b) => (a.sort_order||0)-(b.sort_order||0)).map(e => `- ${e.event_date ? `[${e.event_date}] ` : ''}${e.title}: ${e.description}`).join('\n')
      }

      const result = await aiService.analyzeContinuity({
        content: activeChapter.content,
        storyContext: contextStr,
        provider: settings.ai_provider as any,
        apiKey: settings?.ai_api_key, providerSettings: settings?.ai_settings
      })

      // Guard against empty fallback data
      if (result.events.length === 0 && result.warnings.length === 0) {
        addToast('AI found no events or warnings, or the request failed. Try again.', 'info')
        return
      }

      // Create events
      for (const ev of result.events) {
        const added = await window.api.continuityEvents.create({
          chapter_id: chapterId,
          description: ev.description,
          event_type: ev.event_type
        })
        addContinuityEvent(added)
      }

      // Create warnings
      for (const warn of result.warnings) {
        const added = await window.api.continuityWarnings.create({
          chapter_id: chapterId,
          warning_description: warn.warning_description,
          severity: warn.severity
        })
        addContinuityWarning(added)
      }

      addToast('Continuity analysis complete!', 'success')
    } catch (e: any) {
      console.error(e)
      addToast(e.message || 'AI Analysis failed.', 'error')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAddEvent = async (description: string) => {
    const added = await window.api.continuityEvents.create({ chapter_id: chapterId, description, event_type: 'General' })
    addContinuityEvent(added)
  }

  const handleDeleteEvent = async (id: string) => {
    try {
      await window.api.continuityEvents.delete(id)
      removeContinuityEvent(chapterId, id)
    } catch {
      addToast('Failed to delete event', 'error')
    }
  }

  const handleAddWarning = async (warning_description: string) => {
    const added = await window.api.continuityWarnings.create({ chapter_id: chapterId, warning_description, severity: 'Medium' })
    addContinuityWarning(added)
  }

  const handleResolveWarning = async (id: string) => {
    try {
      await window.api.continuityWarnings.resolve(id)
      resolveContinuityWarning(chapterId, id)
      addToast('Warning resolved', 'success')
    } catch {
      addToast('Failed to resolve warning', 'error')
    }
  }

  const handleDeleteWarning = async (id: string) => {
    try {
      await window.api.continuityWarnings.delete(id)
      removeContinuityWarning(chapterId, id)
    } catch {
      addToast('Failed to delete warning', 'error')
    }
  }

  const events = continuityEvents[chapterId] ?? []
  const warnings = continuityWarnings[chapterId] ?? []
  const openWarnings = warnings.filter(warning => !warning.resolved)
  const resolvedWarnings = warnings.filter(warning => warning.resolved)
  const loaded = loadState === 'loaded'

  function renderWarning(warning: ContinuityWarning) {
    const critical = /^(critical|high)$/i.test(warning.severity)
    return (
      <li key={warning.id} className={cn(
        panelCard,
        !warning.resolved && (critical ? 'border-l-2 border-l-danger-500' : 'border-l-2 border-l-warning-500')
      )}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            warning.resolved ? 'bg-[hsl(var(--brand-green-bg))] text-[hsl(var(--brand-green))]'
              : critical ? 'bg-danger-500/10 text-surface-200' : 'bg-warning-500/10 text-surface-200'
          )}>
            {warning.resolved ? 'Resolved' : warning.severity}
          </span>
          <div className="flex items-center gap-1">
            {!warning.resolved && (
              <button type="button" onClick={() => void handleResolveWarning(warning.id)} className={`${panelIconButton} hover:text-success-500`}
                aria-label="Resolve warning" title="Resolve warning">
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={() => void handleDeleteWarning(warning.id)} className={`${panelIconButton} hover:text-danger-500`}
              aria-label="Delete warning" title="Delete warning">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className={cn('whitespace-pre-wrap break-words text-sm leading-relaxed', warning.resolved ? 'text-surface-400' : 'text-surface-200')}>
          {warning.warning_description}
        </p>
      </li>
    )
  }

  return (
    <EditorToolPanel id="continuity-panel" title="Continuity Engine" icon={Shield} onClose={onClose}
      action={<PanelAnalyzeButton busy={isAnalyzing} disabled={!loaded} onClick={() => void handleAnalyzeContinuity()} />}>
      {loadState === 'loading' && <p role="status" className="text-sm text-surface-400">Loading continuity records…</p>}
      {loadState === 'error' && <p role="alert" className="rounded-lg border border-danger-500/30 p-3 text-sm">Continuity records could not be loaded. Reopen the panel to try again.</p>}

      {loaded && (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-surface-800 bg-[hsl(var(--studio-paper))] px-2.5 py-2">
              <dt className="text-xs text-surface-400">Open warnings</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                <AlertTriangle className={cn('h-3.5 w-3.5', openWarnings.length ? 'text-warning-500' : 'text-surface-500')} aria-hidden="true" />
                {openWarnings.length}
              </dd>
            </div>
            <div className="rounded-lg border border-surface-800 bg-[hsl(var(--studio-paper))] px-2.5 py-2">
              <dt className="text-xs text-surface-400">Canon events</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold tabular-nums">
                <BookOpen className="h-3.5 w-3.5 text-[hsl(var(--brand-green))]" aria-hidden="true" />
                {events.length}
              </dd>
            </div>
          </dl>

          <section aria-label="Continuity warnings" className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Warnings</h4>
              <EntryComposer label="Add warning" placeholder="What needs checking?" onAdd={handleAddWarning} />
            </div>

            {openWarnings.length > 0 ? (
              <ul className="space-y-2">{openWarnings.map(renderWarning)}</ul>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--brand-green)/0.25)] bg-[hsl(var(--brand-green-bg))] px-3 py-2.5 text-sm text-[hsl(var(--brand-green))]">
                <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>No open warnings</span>
              </div>
            )}

            {resolvedWarnings.length > 0 && (
              <details className="rounded-lg border border-surface-800 bg-[hsl(var(--studio-header))] px-2.5 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-surface-400 [&::-webkit-details-marker]:hidden">
                  Resolved warnings ({resolvedWarnings.length})
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </summary>
                <ul className="mt-2 space-y-2">{resolvedWarnings.map(renderWarning)}</ul>
              </details>
            )}
          </section>

          <section aria-label="Canon events" className="space-y-2.5 border-t border-surface-800 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Canon events</h4>
              <EntryComposer label="Add event" placeholder="What became canon in this chapter?" onAdd={handleAddEvent} />
            </div>

            {events.length > 0 ? (
              <ol className="ml-1.5 space-y-2.5 border-l border-surface-700 pl-3">
                {events.map(event => (
                  <li key={event.id} className="relative rounded-lg border border-surface-800 bg-[hsl(var(--studio-paper))] p-3">
                    <span className="absolute -left-[1.04rem] top-4 h-2 w-2 rounded-full bg-[hsl(var(--brand-green))]" aria-hidden="true" />
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                      <span className="max-w-full break-words rounded-full bg-[hsl(var(--brand-green-bg))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--brand-green))]">
                        {event.event_type}
                      </span>
                      <button type="button" onClick={() => void handleDeleteEvent(event.id)} className={`${panelIconButton} hover:text-danger-500`}
                        aria-label="Delete event" title="Delete event">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-surface-200">{event.description}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <PanelEmptyState icon={BookOpen} title="No canon events logged" />
            )}
          </section>
        </>
      )}
    </EditorToolPanel>
  )
}
