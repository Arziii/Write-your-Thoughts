import { useState } from 'react'
import type { ChangeEvent, ComponentPropsWithoutRef, FormEvent } from 'react'
import { ArrowUpRight, ImagePlus, Link2, Plus, X } from 'lucide-react'
import { referencePages } from '../../../../shared/referencePages'
import type { ReferenceDetails, ReferenceKind, ReferenceLink, ReferenceLinkKind } from '../../../../shared/referencePages'
import OrganizationMembers from './OrganizationMembers'

export interface ReferenceTarget {
  id: string
  type: ReferenceLinkKind
  title: string
}

const inputStyle = 'profile-worksheet-input min-w-0'
const buttonStyle = 'inline-flex items-center gap-1.5 rounded-md border border-[var(--worksheet-edge)] px-2.5 py-1.5 text-xs font-medium hover:bg-[hsl(var(--brand-green-bg))] disabled:opacity-50'
const linkKey = ({ id, type, role }: ReferenceLink) => JSON.stringify([type, id, role])
const targetKey = ({ id, type }: ReferenceTarget) => JSON.stringify([type, id])
const fieldCard = 'profile-worksheet-card block'

function GrowingField({ value, ...props }: Omit<ComponentPropsWithoutRef<'textarea'>, 'value'> & { value: string }) {
  return (
    <span className="reference-growing-field" data-content={value}>
      <textarea {...props} value={value} rows={2} className={inputStyle} />
    </span>
  )
}

const typeLabels: Record<ReferenceLinkKind, string> = {
  chapter: 'Chapter', character: 'Character', location: 'Location', organization: 'Organization',
  world_rule: 'World rule', codex: 'Codex', wiki: 'Wiki', note: 'Note',
}

interface Props {
  kind: ReferenceKind
  details: ReferenceDetails
  targets: ReferenceTarget[]
  onChange: (update: (current: ReferenceDetails) => ReferenceDetails) => void
  onOpen: (target: ReferenceTarget) => void
}

export default function ReferenceCards({ kind, details, targets, onChange, onOpen }: Props) {
  const config = referencePages[kind]
  const [role, setRole] = useState<string>(config.linkRoles[0])
  const [selectedTarget, setSelectedTarget] = useState('')
  const [artError, setArtError] = useState('')
  const [processingArt, setProcessingArt] = useState(false)
  const entries = details.entries ?? []
  const tags = [...new Set((details.fields.Tags ?? '').split(',').map(tag => tag.trim()).filter(Boolean))]

  const eligibleTargets = targets.filter(target => {
    if (role === 'Leadership') return target.type === 'character'
    if (role === 'Headquarters' || role === 'Territory') return target.type === 'location'
    if (role === 'Allies' || role === 'Rivals') return target.type === 'organization' || target.type === 'character'
    if (role === 'Example chapter' || role === 'Source chapter') return target.type === 'chapter'
    return true
  })
  const target = eligibleTargets.find(item => targetKey(item) === selectedTarget)
  const newLink = target ? { id: target.id, type: target.type, role } : null
  const canLink = newLink && !details.links.some(link => linkKey(link) === linkKey(newLink)) && details.links.length < 40

  function addLink(event: FormEvent) {
    event.preventDefault()
    if (!newLink || !canLink) return
    onChange(current => ({ ...current, links: [...current.links, newLink] }))
    setSelectedTarget('')
  }

  async function uploadArtwork(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || processingArt) return
    setArtError('')
    setProcessingArt(true)
    try {
      if (file.size > 12 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        throw new Error('Choose a PNG, JPEG, or WebP image up to 12 MB.')
      }
      const bitmap = await createImageBitmap(file)
      try {
        const scale = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(bitmap.width * scale))
        canvas.height = Math.max(1, Math.round(bitmap.height * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Artwork could not be prepared.')
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        const artwork = canvas.toDataURL('image/webp', 0.82)
        if (!artwork.startsWith('data:image/webp;base64,') || artwork.length > 350_000) {
          throw new Error('This artwork is too large after resizing. Try a smaller image.')
        }
        onChange(current => ({ ...current, artwork }))
      } finally {
        bitmap.close()
      }
    } catch (error) {
      setArtError(error instanceof Error ? error.message : 'The image could not be opened.')
    } finally {
      setProcessingArt(false)
    }
  }

  function updateEntry(id: string, patch: { title?: string; details?: string }) {
    onChange(current => ({ ...current, entries: current.entries?.map(entry => entry.id === id ? { ...entry, ...patch } : entry) }))
  }

  return (
    <div className="space-y-5">
      <div className="profile-worksheet-sections">
        {config.artwork && (
          <section className={fieldCard}>
            <h3 className="profile-worksheet-heading">{config.artwork}</h3>
            <div className="min-w-0 space-y-2">
              {details.artwork && <img src={details.artwork} alt={config.artwork} className="max-h-52 max-w-full rounded-lg bg-[var(--worksheet-paper)] object-contain" />}
              <div className="flex flex-wrap gap-2">
                <label className={`${buttonStyle} cursor-pointer focus-within:outline`}>
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                  {processingArt ? 'Preparing image…' : details.artwork ? 'Replace image' : 'Add image'}
                  <input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={uploadArtwork} disabled={processingArt} />
                </label>
                {details.artwork && <button type="button" className={buttonStyle} onClick={() => onChange(current => ({ ...current, artwork: undefined }))}>Remove image</button>}
              </div>
              {artError && <p role="alert" className="text-xs text-danger-500">{artError}</p>}
            </div>
          </section>
        )}
        {config.fields.map(field => (
          <label key={field} className={fieldCard}>
            <span className="profile-worksheet-heading">{field}</span>
            <span className="min-w-0 space-y-2">
              {field === 'Tags' && tags.length > 0 && (
                <span aria-hidden="true" className="flex flex-wrap gap-1.5">
                  {tags.map(tag => <span key={tag} className="break-all rounded-full bg-[hsl(var(--brand-green-bg))] px-2 py-0.5 text-xs text-[hsl(var(--brand-green))]">{tag}</span>)}
                </span>
              )}
              <GrowingField aria-label={field} maxLength={2400} value={details.fields[field] ?? ''}
                placeholder={field === 'Tags' ? 'Separate tags with commas' : undefined}
                onChange={event => {
                  const value = event.target.value
                  onChange(current => ({ ...current, fields: { ...current.fields, [field]: value } }))
                }} />
            </span>
          </label>
        ))}
      </div>

      {kind === 'organization' && (
        <OrganizationMembers members={details.members ?? []} characters={targets.filter(item => item.type === 'character')}
          onChange={update => onChange(current => ({ ...current, members: update(current.members ?? []) }))} onOpen={onOpen} />
      )}

      {kind === 'codex' && (
        <section className="profile-worksheet-card" aria-label="Entry cards">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="profile-worksheet-heading !mb-0">Entry cards</h3>
            <button type="button" className={buttonStyle} disabled={entries.length >= 24}
              onClick={() => onChange(current => ({
                ...current, entries: [...(current.entries ?? []), { id: crypto.randomUUID(), title: '', details: '' }],
              }))}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add card
            </button>
          </div>
          {entries.length > 0 && (
            <div className="divide-y divide-[var(--worksheet-edge)]">
              {entries.map(entry => (
                <div key={entry.id} className="flex flex-col gap-2 py-3 last:pb-0">
                  <div className="flex items-center gap-1">
                    <input className={`${inputStyle} flex-1`} aria-label="Card name" placeholder="Name" maxLength={120} value={entry.title}
                      onChange={event => updateEntry(entry.id, { title: event.target.value })} />
                    <button type="button" className="rounded p-1 hover:bg-[hsl(var(--brand-green-bg))]" aria-label={`Remove card ${entry.title || 'without a name'}`}
                      onClick={() => onChange(current => ({ ...current, entries: current.entries?.filter(item => item.id !== entry.id) }))}>
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <GrowingField aria-label="Card details" placeholder="Details" maxLength={1200} value={entry.details}
                    onChange={event => updateEntry(entry.id, { details: event.target.value })} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="profile-worksheet-card space-y-3">
        <h3 className="profile-worksheet-heading !flex items-center gap-2"><Link2 className="h-4 w-4" aria-hidden="true" /> Linked records</h3>
        {details.links.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {details.links.map(link => {
              const item = targets.find(candidate => candidate.type === link.type && candidate.id === link.id)
              return (
                <li key={linkKey(link)} className="flex items-center gap-1 rounded-md border border-[var(--worksheet-edge)] bg-surface-950 px-2 py-1 text-xs">
                  <span className="text-[var(--worksheet-muted)]">{link.role}</span>
                  {item ? (
                    <button type="button" className="flex items-center gap-1 text-left font-medium hover:underline" onClick={() => onOpen(item)}>
                      {item.title} <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : <span className="text-[var(--worksheet-muted)]">Record unavailable</span>}
                  <button type="button" aria-label={`Remove link to ${item?.title ?? 'unavailable record'}`} className="rounded p-1 hover:bg-[hsl(var(--brand-green-bg))]"
                    onClick={() => onChange(current => ({ ...current, links: current.links.filter(existing => linkKey(existing) !== linkKey(link)) }))}>
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <form onSubmit={addLink} className="flex flex-wrap items-center gap-2">
          <select aria-label="Link role" className={`${inputStyle} !w-auto max-w-full`} value={role}
            onChange={event => { setRole(event.target.value); setSelectedTarget('') }}>
            {config.linkRoles.map(option => <option key={option}>{option}</option>)}
          </select>
          <select aria-label="Record to link" className={`${inputStyle} !w-auto max-w-full flex-1`} value={selectedTarget} onChange={event => setSelectedTarget(event.target.value)}>
            <option value="">{eligibleTargets.length ? 'Choose a record' : 'No matching records'}</option>
            {eligibleTargets.map(entry => <option key={targetKey(entry)} value={targetKey(entry)}>{entry.title} ({typeLabels[entry.type]})</option>)}
          </select>
          <button type="submit" className={buttonStyle} disabled={!canLink}>Add link</button>
        </form>
      </section>
    </div>
  )
}
