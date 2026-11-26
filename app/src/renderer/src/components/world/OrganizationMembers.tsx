import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Plus, X } from 'lucide-react'
import type { OrganizationMember } from '../../../../shared/referencePages'
import type { ReferenceTarget } from './ReferenceCards'

interface Props {
  members: OrganizationMember[]
  characters: ReferenceTarget[]
  onChange: (update: (members: OrganizationMember[]) => OrganizationMember[]) => void
  onOpen: (character: ReferenceTarget) => void
}

const field = 'profile-worksheet-input !w-auto min-w-0 max-w-full'

export default function OrganizationMembers({ members, characters, onChange, onOpen }: Props) {
  const [newMemberId, setNewMemberId] = useState('')
  const newName = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (newMemberId) newName.current?.focus()
  }, [newMemberId])

  function addMember() {
    const id = crypto.randomUUID()
    onChange(current => [...current, { id, name: '', rank: '' }])
    setNewMemberId(id)
  }

  function editMember(id: string, patch: Partial<OrganizationMember>) {
    onChange(current => current.map(member => member.id === id ? { ...member, ...patch } : member))
  }

  return (
    <section className="profile-worksheet-card space-y-3" aria-label="Organization members">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="profile-worksheet-heading !mb-0">Members{members.length ? ` (${members.length})` : ''}</h3>
        <button type="button" onClick={addMember}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--worksheet-edge)] px-2.5 py-1.5 text-xs font-medium hover:bg-[hsl(var(--brand-green-bg))]">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add member
        </button>
      </div>
      {members.length ? (
        <ul className="divide-y divide-[var(--worksheet-edge)]">
          {members.map((member, index) => {
            const character = characters.find(item => item.id === member.characterId)
            return (
              <li key={member.id} className="flex flex-wrap items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                {character ? (
                  <button type="button" className="flex min-w-36 flex-1 items-center gap-1.5 break-words text-left text-sm font-medium hover:underline"
                    onClick={() => onOpen(character)}>
                    <span className="min-w-0">{character.title}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  </button>
                ) : (
                  <input ref={member.id === newMemberId ? newName : undefined} value={member.name} maxLength={2400}
                    aria-label={`Member ${index + 1} name`} placeholder="Member name" className={`${field} min-w-36 flex-1`}
                    onChange={event => editMember(member.id, { name: event.target.value, characterId: undefined })} />
                )}
                <select value={character?.id ?? ''} aria-label={`Member ${index + 1} character link`}
                  className={`${field} max-w-56 grow`} onChange={event => {
                    const selected = characters.find(item => item.id === event.target.value)
                    editMember(member.id, { characterId: selected?.id, name: selected?.title ?? character?.title ?? member.name })
                  }}>
                  <option value="">{character ? 'Use typed name' : 'Link a character (optional)'}</option>
                  {characters.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
                <input value={member.rank} maxLength={120} aria-label={`Member ${index + 1} role or rank`}
                  className={`${field} grow`} placeholder="Role or rank (optional)"
                  onChange={event => editMember(member.id, { rank: event.target.value })} />
                <button type="button" aria-label={`Remove member ${index + 1}`} className="rounded p-1.5 hover:bg-[hsl(var(--brand-green-bg))]"
                  onClick={() => onChange(current => current.filter(item => item.id !== member.id))}>
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : <p className="text-xs text-[var(--worksheet-muted)]">Add a name or link a character from this book.</p>}
    </section>
  )
}
