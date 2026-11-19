import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Sparkles, X } from 'lucide-react'
import type { LocationChapterReference } from '../../../../shared/maps'
import { buildLocationEvidence, getLocationSummary, locationEvidenceKey, locationFields, readLocationSummary } from '../../services/locationSummary'
import type { LocationFact } from '../../services/locationSummary'
import { useUserStore } from '../../stores/userStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { Location } from '../../types'

const button = 'inline-flex items-center gap-1.5 rounded-md border border-surface-700 px-2.5 py-1.5 text-xs font-medium hover:bg-surface-800 disabled:opacity-50'

export default function LocationSummaryPanel({ location, onClose }: { location: Location; onClose: () => void }) {
  const openTab = useWorkspaceStore(state => state.openTab)
  const settings = useUserStore(state => state.settings)
  const [references, setReferences] = useState<LocationChapterReference[] | null>(null)
  const [sourceError, setSourceError] = useState('')
  const [summary, setSummary] = useState<{ key: string; facts: LocationFact[] } | null>(null)
  const [evidenceKey, setEvidenceKey] = useState('')
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')

  const evidence = useMemo(() => references && buildLocationEvidence(location, references), [location, references])
  const facts = summary?.key === evidenceKey ? summary?.facts : null
  const hasEvidence = Boolean(evidence?.record.length || evidence?.chapters.length)
  const aiChapterCount = evidence?.chapters.length ?? 0

  useEffect(() => {
    let cancelled = false
    setReferences(null)
    setSourceError('')
    window.api.search.locationReferences(location.id).then((rows: LocationChapterReference[]) => {
      if (!cancelled) setReferences(rows)
    }).catch(() => {
      if (!cancelled) setSourceError('Could not load chapter references. Close and reopen the summary to retry.')
    })
    return () => { cancelled = true }
  }, [location.id, location.name])

  useEffect(() => {
    if (!evidence) return
    let cancelled = false
    locationEvidenceKey(evidence).then(key => {
      if (cancelled) return
      setEvidenceKey(key)
      const cached = readLocationSummary(location.id, key, evidence)
      setSummary(cached ? { key, facts: cached } : null)
    }).catch(() => {
      if (!cancelled) setAiError('Could not prepare the summary. Close and reopen the panel to retry.')
    })
    return () => { cancelled = true }
  }, [location.id, evidence])

  const openRecord = () => openTab(location.id, 'location', location.name)
  const openChapter = (chapter: { chapterId: string; title: string }, hasPassage = true) =>
    openTab(chapter.chapterId, 'chapter', chapter.title, hasPassage
      ? { type: 'chapter', chapterId: chapter.chapterId, query: location.name.trim() }
      : undefined)

  async function generate() {
    if (generating || !settings || !evidence || !hasEvidence) return
    setGenerating(true)
    setAiError('')
    try {
      const key = await locationEvidenceKey(evidence)
      const result = await getLocationSummary(location.id, key, evidence, settings)
      setSummary({ key, facts: result })
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Could not generate the summary.')
    } finally {
      setGenerating(false)
    }
  }

  const storedFields = locationFields.filter(([field]) => location[field]?.trim())

  return (
    <aside aria-label={`Location summary for ${location.name}`} className="flex w-[min(22rem,48%)] shrink-0 flex-col border-l border-surface-800 bg-surface-950">
      <header className="flex items-start justify-between gap-2 border-b border-surface-800 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-surface-400">Location summary</p>
          <h3 className="mt-1 break-words font-semibold text-surface-50">{location.name}</h3>
        </div>
        <button type="button" className="shrink-0 rounded p-1 hover:bg-surface-800" onClick={onClose} aria-label="Close location summary"><X className="h-4 w-4" /></button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold">Saved location details</h4>
            <button type="button" className={button} onClick={openRecord}>Open location <ArrowUpRight className="h-3 w-3" /></button>
          </div>
          {storedFields.length ? (
            <dl className="space-y-2">
              {storedFields.map(([field, label]) => (
                <div key={field}>
                  <dt className="text-xs font-medium text-surface-400">{label}</dt>
                  <dd className="whitespace-pre-wrap break-words text-surface-300">{location[field]}</dd>
                </div>
              ))}
            </dl>
          ) : <p className="text-surface-400">This location has no saved details yet.</p>}
        </section>

        <section className="space-y-2 border-t border-surface-800 pt-4">
          <h4 className="font-semibold">AI summary</h4>
          {facts ? facts.length ? (
            <ul className="space-y-3">
              {facts.map((fact, index) => (
                <li key={index}>
                  <p className="text-xs font-semibold text-surface-400">{fact.topic}</p>
                  <p className="break-words">{fact.text}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {fact.sources.map(source => {
                      const chapter = evidence?.chapters[source - 1]
                      return (
                        <button key={source} type="button" className="text-left text-xs text-accent-600 underline"
                          onClick={source === 0 ? openRecord : () => { if (chapter) openChapter(chapter) }}>
                          {source === 0 ? 'Location record' : chapter?.title}
                        </button>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-surface-400">The AI found no supported facts in the supplied sources.</p> : (
            <>
              {hasEvidence && settings ? (
                <p className="text-xs text-surface-400">Sends saved details and excerpts from up to {aiChapterCount} matching {aiChapterCount === 1 ? 'chapter' : 'chapters'} to your configured AI provider.</p>
              ) : <p className="text-xs text-surface-400">{!settings ? 'Configure an AI provider in Settings to generate a summary.' : 'Add location details or a chapter mention to enable an AI summary.'}</p>}
              <button type="button" className={button} disabled={!hasEvidence || !settings || generating || !evidenceKey} onClick={generate}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {generating ? 'Generating…' : 'Generate summary'}
              </button>
            </>
          )}
          {aiError && <p role="alert" className="break-words text-xs text-danger-500">{aiError}</p>}
        </section>

        <section className="space-y-2 border-t border-surface-800 pt-4">
          <h4 className="font-semibold">Chapter references{references ? ` (${references.length})` : ''}</h4>
          {sourceError ? <p role="alert" className="text-surface-400">{sourceError}</p>
            : references === null ? <p role="status" className="text-surface-400">Checking saved chapters…</p>
            : references.length === 0 ? <p className="text-surface-400">No saved chapters mention this location by name.</p>
            : (
              <ul className="space-y-3">
                {references.map(chapter => (
                  <li key={chapter.chapterId}>
                    <button type="button" className="text-left text-xs font-semibold text-accent-600 hover:underline" onClick={() => openChapter(chapter, Boolean(chapter.excerpts.length))}>
                      {chapter.title} <ArrowUpRight className="inline h-3 w-3" />
                    </button>
                    {chapter.excerpts[0] && <p className="mt-1 break-words text-xs text-surface-400">{chapter.excerpts[0]}</p>}
                  </li>
                ))}
              </ul>
            )}
        </section>
      </div>
    </aside>
  )
}
