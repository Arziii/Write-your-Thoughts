export const referencePages = {
  organization: {
    label: 'Organization', body: 'Lore', artwork: 'Emblem',
    fields: ['Overview', 'Goals', 'Leadership', 'Territory', 'Headquarters', 'Allies', 'Rivals'],
    linkRoles: ['Leadership', 'Territory', 'Headquarters', 'Allies', 'Rivals', 'Related'],
  },
  world_rule: {
    label: 'World rule', body: 'Rule notes', artwork: null,
    fields: ['What it does', 'Limits', 'Exceptions', 'Manuscript examples'],
    linkRoles: ['Example chapter', 'Related'],
  },
  codex: {
    label: 'Codex entry', body: 'Lore', artwork: 'Illustration',
    fields: ['Summary', 'Category', 'Key facts'],
    linkRoles: ['Related', 'Source chapter'],
  },
  wiki: {
    label: 'Wiki article', body: 'Article', artwork: null,
    fields: ['Summary', 'Tags'],
    linkRoles: ['Related', 'Source chapter'],
  },
  note: {
    label: 'Note', body: 'Notes', artwork: null,
    fields: ['Summary', 'Tags'],
    linkRoles: ['Related', 'Source chapter'],
  },
} as const

export type ReferenceKind = keyof typeof referencePages
export type ReferenceLinkKind = ReferenceKind | 'character' | 'location' | 'chapter'

export interface ReferenceLink {
  id: string
  type: ReferenceLinkKind
  role: string
}

export interface OrganizationMember {
  id: string
  name: string
  rank: string
  characterId?: string
}

export interface ReferenceDetails {
  fields: Record<string, string>
  links: ReferenceLink[]
  artwork?: string
  entries?: { id: string; title: string; details: string }[]
  members?: OrganizationMember[]
}

export const emptyReferenceDetails: ReferenceDetails = { fields: {}, links: [] }

export interface SaveReferencePage {
  id: string
  kind: ReferenceKind
  content: string
  title: string
  details: ReferenceDetails
}

export function isReferenceKind(value: string): value is ReferenceKind {
  return Object.prototype.hasOwnProperty.call(referencePages, value)
}

