import type { IpcMain } from 'electron'
import { dbGet, dbRun, dbRunQueuedEdit, getDb } from '../database/init'
import { emptyReferenceDetails, isReferenceKind, referencePages } from '../../shared/referencePages'
import type { OrganizationMember, ReferenceDetails, ReferenceKind, SaveReferencePage } from '../../shared/referencePages'

const tables: Record<ReferenceKind, { name: string; sync: string }> = {
  note: { name: 'notes', sync: 'note' },
  codex: { name: 'codex', sync: 'codex' },
  wiki: { name: 'wiki', sync: 'wiki' },
  organization: { name: 'organizations', sync: 'organizations' },
  world_rule: { name: 'world_rules', sync: 'world_rules' },
}
const relatedTables = { ...Object.fromEntries(Object.entries(tables).map(([kind, table]) => [kind, table.name])),
  character: 'characters', location: 'locations', chapter: 'chapters',
} as Record<string, string>

const writeDetails = `INSERT INTO reference_page_details (kind, entity_id, book_id, details)
  VALUES (?, ?, ?, ?) ON CONFLICT(kind, entity_id) DO UPDATE SET details = excluded.details`

function findCharacterName(id: string, bookId: string): string | undefined {
  const character = dbGet('SELECT name FROM characters WHERE id = ? AND book_id = ?', [id, bookId])
  return typeof character?.name === 'string' ? character.name : undefined
}

function upgradeOrganizationMembers(details: ReferenceDetails, bookId: string): ReferenceDetails {
  const { Members: previousNames, ...fields } = details.fields ?? {}
  const links = Array.isArray(details.links) ? details.links : []
  const previousLinks = links.filter(link => link?.role === 'Members' && link.type === 'character')
  if (!previousNames && !previousLinks.length) return details

  const members: OrganizationMember[] = [
    ...(Array.isArray(details.members) ? details.members.filter(member => typeof member?.name === 'string').map(member => ({ ...member })) : []),
    ...(typeof previousNames === 'string' ? previousNames : '').split(/\r?\n/).map(name => name.trim()).filter(Boolean)
      .map((name, index) => ({ id: `legacy-member-${index}`, name, rank: '' })),
  ]
  for (const link of previousLinks) {
    if (members.some(member => member.characterId === link.id)) continue
    const name = findCharacterName(link.id, bookId)
    if (name === undefined) continue
    const existing = members.find(member => !member.characterId && member.name.toLowerCase() === name.toLowerCase())
    if (existing) existing.characterId = link.id
    else members.push({ id: `legacy-character-${link.id}`, name, rank: '', characterId: link.id })
  }
  return { ...details, fields, members, links: links.filter(link => link?.role !== 'Members' || link.type !== 'character') }
}

function normalizeDetails(details: ReferenceDetails, kind: ReferenceKind, bookId: string): ReferenceDetails {
  if (kind === 'organization') details = upgradeOrganizationMembers(details, bookId)
  const config = referencePages[kind]
  const fields = Object.fromEntries(config.fields.flatMap(field =>
    typeof details.fields?.[field] === 'string' && details.fields[field].trim()
      ? [[field, details.fields[field].slice(0, 2400)]]
      : []))
  const links = (Array.isArray(details.links) ? details.links : []).slice(0, 40).filter(link => {
    if (!link || typeof link.id !== 'string' || !Object.prototype.hasOwnProperty.call(relatedTables, link.type) ||
        !(config.linkRoles as readonly string[]).includes(link.role)) return false
    return Boolean(dbGet(`SELECT id FROM ${relatedTables[link.type]} WHERE id = ? AND book_id = ?`, [link.id, bookId]))
  })
  const result: ReferenceDetails = { fields, links }
  if (kind === 'organization' && Array.isArray(details.members)) {
    result.members = details.members.flatMap(member => {
      if (!member || typeof member.id !== 'string' || !member.id) return []
      const name = typeof member.name === 'string' ? member.name.slice(0, 2400) : ''
      const rank = typeof member.rank === 'string' ? member.rank.slice(0, 120) : ''
      const characterId = typeof member.characterId === 'string' ? member.characterId : undefined
      const linkedName = characterId ? findCharacterName(characterId, bookId) : undefined
      return [{ id: member.id.slice(0, 100), name: linkedName ?? name, rank,
        characterId: linkedName !== undefined ? characterId : undefined }]
    })
  }
  if (config.artwork && typeof details.artwork === 'string' && details.artwork.length <= 350_000 &&
      /^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/.test(details.artwork)) result.artwork = details.artwork
  if (kind === 'codex' && Array.isArray(details.entries)) {
    result.entries = details.entries.slice(0, 24).filter(entry => entry && typeof entry.id === 'string')
      .map(entry => ({
        id: entry.id.slice(0, 64),
        title: typeof entry.title === 'string' ? entry.title.slice(0, 120) : '',
        details: typeof entry.details === 'string' ? entry.details.slice(0, 1200) : '',
      }))
  }
  return result
}

export function registerReferencePageHandlers(ipcMain: IpcMain) {
  ipcMain.handle('referencePages:load', (_event, { kind, id }: Pick<SaveReferencePage, 'kind' | 'id'>): ReferenceDetails => {
    if (!isReferenceKind(kind)) throw new Error('Invalid reference page')
    const row = dbGet('SELECT book_id, details FROM reference_page_details WHERE kind = ? AND entity_id = ?', [kind, id])
    if (typeof row?.details !== 'string') return emptyReferenceDetails
    const stored: ReferenceDetails = JSON.parse(row.details)
    return kind === 'organization' && typeof row.book_id === 'string' ? upgradeOrganizationMembers(stored, row.book_id) : stored
  })

  ipcMain.handle('referencePages:save', (_event, data: SaveReferencePage) => {
    const { kind, id, title, content, details } = data
    if (!isReferenceKind(kind) || typeof title !== 'string' || typeof content !== 'string' || !details) {
      throw new Error('Invalid reference page')
    }
    const table = tables[kind]
    const existing = dbGet(`SELECT * FROM ${table.name} WHERE id = ?`, [id])
    if (!existing || typeof existing.book_id !== 'string') throw new Error('Reference page could not be found')
    const normalized = JSON.stringify(normalizeDetails(details, kind, existing.book_id))
    const previous = dbGet('SELECT details FROM reference_page_details WHERE kind = ? AND entity_id = ?', [kind, id])
    const detailsChanged = (previous?.details ?? JSON.stringify(emptyReferenceDetails)) !== normalized
    const values = [kind, id, existing.book_id, normalized]

    if (existing.title !== title || (existing.content ?? '') !== content) {
      const now = new Date().toISOString()
      dbRunQueuedEdit(`UPDATE ${table.name} SET title = ?, content = ?, updated_at = ?, synced = 0 WHERE id = ?`,
        [title, content, now, id], table.sync, id, now,
        detailsChanged ? () => { getDb().run(writeDetails, values) } : undefined)
    } else if (detailsChanged) {
      dbRun(writeDetails, values)
    }
    return dbGet(`SELECT * FROM ${table.name} WHERE id = ?`, [id])
  })
}

