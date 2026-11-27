import {
  cleanFileStem,
  countWords,
  escapeHtml,
  extractMetadataFromLines,
  getImportFormat,
  parseDocumentBytes,
  type ParsedDocument,
  type SupportedImportFormat,
} from './documentParsers'
import { isZipBytes, readZipEntries } from './zipReader'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import type { Book, Chapter, Character, Codex, Location, Note, Organization, VerseTimelineEvent, Wiki, WorldRule } from '../../types'

export type ImportEntityKind =
  | 'chapter'
  | 'character'
  | 'location'
  | 'organization'
  | 'world_rule'
  | 'codex'
  | 'wiki'
  | 'note'
  | 'timeline_event'

export interface ImportEntityMeta {
  kind: ImportEntityKind
  label: string
  pluralLabel: string
}

export const IMPORT_ENTITY_KINDS: ImportEntityMeta[] = [
  { kind: 'chapter', label: 'Chapter', pluralLabel: 'Chapters' },
  { kind: 'character', label: 'Character', pluralLabel: 'Characters' },
  { kind: 'location', label: 'Location', pluralLabel: 'Locations' },
  { kind: 'organization', label: 'Organization', pluralLabel: 'Organizations' },
  { kind: 'world_rule', label: 'World Rule', pluralLabel: 'World Rules' },
  { kind: 'codex', label: 'Codex', pluralLabel: 'Codex Entries' },
  { kind: 'wiki', label: 'Wiki', pluralLabel: 'Wiki Pages' },
  { kind: 'note', label: 'Note', pluralLabel: 'Notes' },
  { kind: 'timeline_event', label: 'Timeline Event', pluralLabel: 'Timeline Events' },
]

export interface ImportCandidate {
  id: string
  selected: boolean
  title: string
  kind: ImportEntityKind
  sourceFile: string
  format: SupportedImportFormat
  html: string
  plainText: string
  wordCount: number
  metadataFields: Record<string, string>
  preview: string
  warnings: string[]
  sortHint: number
}

export interface PreparedImportBatch {
  candidates: ImportCandidate[]
  suggestedBookTitle: string
  warnings: string[]
  rawFilesCount: number
}

export interface CommitImportOptions {
  bookId: string
  createNewBook?: {
    userId: string
    title: string
    genre?: string
    description?: string
  }
  items: ImportCandidate[]
  syncToActiveWorkspace: boolean
  onProgress?: (done: number, total: number, currentTitle: string) => void
}

export interface CommitImportResult {
  bookId: string
  bookTitle: string
  createdBook?: Book
  importedCounts: Partial<Record<ImportEntityKind, number>>
  totalImported: number
  failed: Array<{ title: string; kind: ImportEntityKind; error: string }>
}

const CHAPTER_HEADING_REGEX =
  /^(?:(?:prologue|epilogue|interlude|preface|foreword|afterword)|(?:chapter|ch\.?)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[\s\-]+(?:one|two|three|four|five|six|seven|eight|nine))?)|(?:part|act|book)\s+(?:\d+|[ivxlcdm]+|one|two|three|four|five))(?:\s*[:.\-–—]\s*.*)?$/i

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
}

function parseRomanNumeral(roman: string): number | null {
  const s = roman.toUpperCase().trim()
  if (!/^[IVXLCDM]+$/.test(s)) return null
  const values: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const cur = values[s[i]]
    const next = values[s[i + 1]] || 0
    total += cur < next ? -cur : cur
  }
  return total > 0 ? total : null
}

function computeChapterOrderHint(title: string, fallbackIndex: number): number {
  const clean = title.trim().toLowerCase()
  if (/^(preface|foreword)\b/.test(clean)) return -2000 + fallbackIndex
  if (/^prologue\b/.test(clean)) return -1000 + fallbackIndex
  if (/^(epilogue|afterword)\b/.test(clean)) return 100000 + fallbackIndex

  const numMatch = clean.match(/^(?:chapter|ch\.?|part|act)\s+(\d+)\b/)
  if (numMatch) {
    return parseInt(numMatch[1], 10) * 100 + fallbackIndex
  }

  const wordMatch = clean.match(/^(?:chapter|ch\.?|part|act)\s+([a-z\-]+)/)
  if (wordMatch) {
    const token = wordMatch[1]
    if (NUMBER_WORDS[token] !== undefined) {
      return NUMBER_WORDS[token] * 100 + fallbackIndex
    }
    const compound = token.match(/^twenty\-([a-z]+)$/)
    if (compound && NUMBER_WORDS[compound[1]]) {
      return (20 + NUMBER_WORDS[compound[1]]) * 100 + fallbackIndex
    }
    const roman = parseRomanNumeral(token)
    if (roman !== null) {
      return roman * 100 + fallbackIndex
    }
  }

  return 50000 + fallbackIndex
}

function createCandidateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `imp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function makePreview(plainText: string): string {
  const singleLine = plainText.replace(/\s+/g, ' ').trim()
  if (singleLine.length <= 240) return singleLine
  return singleLine.slice(0, 237).trimEnd() + '…'
}

function alnumNorm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function cleanChapterCandidateHeader(
  rawTitle: string,
  rawHtml: string,
  rawPlainText: string
): { title: string; html: string; plainText: string } {
  let title = rawTitle.trim()
  if (!rawHtml || !title) {
    return { title: rawTitle, html: rawHtml, plainText: rawPlainText }
  }

  try {
    const parsed = new DOMParser().parseFromString(rawHtml, 'text/html')
    const elements = Array.from(parsed.body.children)
    if (elements.length < 2) {
      return { title, html: rawHtml, plainText: rawPlainText }
    }

    const titleNorm = alnumNorm(title)
    const getText = (el: Element | undefined) => (el?.textContent || '').replace(/\s+/g, ' ').trim()

    const t0 = getText(elements[0])
    const t1 = getText(elements[1])
    let dropIndices = new Set<number>()

    if (t0 && t0.length <= 100 && alnumNorm(t0) === titleNorm) {
      dropIndices.add(0)
    } else if (
      t0 &&
      t0.length <= 100 &&
      alnumNorm(t0).startsWith(titleNorm) &&
      t0.length > title.length + 2
    ) {
      title = t0
      dropIndices.add(0)
    } else if (
      elements.length >= 3 &&
      t0 &&
      t1 &&
      t0.length <= 100 &&
      t1.length <= 100 &&
      alnumNorm(t1).startsWith(titleNorm) &&
      t1.length > title.length + 2
    ) {
      title = t1
      dropIndices.add(1)
      if (alnumNorm(t1).includes(alnumNorm(t0))) {
        dropIndices.add(0)
      }
    }

    if (dropIndices.size === 0) {
      return { title, html: rawHtml, plainText: rawPlainText }
    }

    const remaining = elements.filter((_, idx) => !dropIndices.has(idx))
    if (remaining.length === 0) {
      return { title, html: rawHtml, plainText: rawPlainText }
    }

    const nextHtml = remaining.map((el) => el.outerHTML).join('\n').trim()
    const nextPlain = remaining.map((el) => getText(el)).filter(Boolean).join('\n\n').trim()
    return {
      title,
      html: nextHtml || rawHtml,
      plainText: nextPlain || rawPlainText,
    }
  } catch {
    return { title: rawTitle, html: rawHtml, plainText: rawPlainText }
  }
}

function splitHtmlByChapterHeadings(doc: ParsedDocument): ParsedDocument[] {
  const parsed = new DOMParser().parseFromString(doc.html, 'text/html')
  const elements = Array.from(parsed.body.children)
  if (elements.length < 2) return [doc]

  const boundaries: Array<{ index: number; heading: string }> = []
  elements.forEach((el, idx) => {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (text && text.length <= 90 && CHAPTER_HEADING_REGEX.test(text)) {
      boundaries.push({ index: idx, heading: text })
    }
  })

  if (boundaries.length < 2 && !(boundaries.length === 1 && boundaries[0].index > 2)) {
    return [doc]
  }

  const splitDocs: ParsedDocument[] = []

  if (boundaries[0].index > 0) {
    const preEls = elements.slice(0, boundaries[0].index)
    const prePlain = preEls.map((e) => (e.textContent || '').trim()).filter(Boolean).join('\n\n')
    if (countWords(prePlain) >= 25) {
      const preHtml = preEls.map((e) => e.outerHTML).join('\n')
      splitDocs.push({
        format: doc.format,
        sourcePath: doc.sourcePath,
        fileName: doc.fileName,
        title: doc.title || cleanFileStem(doc.fileName),
        html: preHtml,
        plainText: prePlain,
        wordCount: countWords(prePlain),
        metadataFields: extractMetadataFromLines(prePlain, doc.metadataFields),
        sections: [],
        warnings: [...doc.warnings],
      })
    }
  }

  for (let b = 0; b < boundaries.length; b++) {
    const start = boundaries[b].index + 1
    const end = b + 1 < boundaries.length ? boundaries[b + 1].index : elements.length
    const bodyEls = elements.slice(start, end)
    const plain = bodyEls.map((e) => (e.textContent || '').trim()).filter(Boolean).join('\n\n')
    if (!plain) continue
    const html = bodyEls.map((e) => e.outerHTML).join('\n')
    splitDocs.push({
      format: doc.format,
      sourcePath: doc.sourcePath,
      fileName: doc.fileName,
      title: boundaries[b].heading,
      html: html || `<p>${escapeHtml(plain)}</p>`,
      plainText: plain,
      wordCount: countWords(plain),
      metadataFields: extractMetadataFromLines(plain),
      sections: [],
      warnings: [...doc.warnings],
    })
  }

  return splitDocs.length >= 2 ? splitDocs : [doc]
}

function splitDocumentIntoCandidates(doc: ParsedDocument): ParsedDocument[] {
  if (doc.sections.length >= 2) {
    return doc.sections.map((sec) => ({
      format: doc.format,
      sourcePath: doc.sourcePath,
      fileName: doc.fileName,
      title: sec.title,
      html: sec.html || '<p></p>',
      plainText: sec.plainText,
      wordCount: countWords(sec.plainText),
      metadataFields: sec.metadataFields,
      sections: [],
      warnings: [...doc.warnings],
    }))
  }

  return splitHtmlByChapterHeadings(doc)
}

const CHAR_KEYS = new Set([
  'age', 'gender', 'pronouns', 'sex', 'nickname', 'alias', 'aliases', 'title', 'aka',
  'also known as', 'moniker', 'appearance', 'physical description', 'physical appearance',
  'looks', 'hair', 'eyes', 'height', 'weight', 'build', 'skin', 'distinctive marks',
  'clothing', 'attire', 'personality', 'traits', 'temperament', 'flaws', 'virtues',
  'habits', 'quirks', 'fears', 'strengths', 'weaknesses', 'alignment', 'mbti',
  'goals', 'goal', 'motivation', 'motivations', 'ambition', 'desire', 'objective',
  'arc', 'relationships', 'family', 'friends', 'allies', 'enemies', 'romance',
  'affiliations', 'relatives', 'occupation', 'species', 'race', 'backstory', 'biography', 'role',
])

const LOC_KEYS = new Set([
  'climate', 'population', 'geography', 'terrain', 'government', 'politics', 'culture',
  'landmarks', 'region', 'history', 'economy', 'inhabitants', 'atmosphere',
  'environment', 'architecture', 'customs', 'traditions', 'flora', 'fauna', 'overview',
])

const ORG_KEYS = new Set([
  'leader', 'leadership', 'headquarters', 'hq', 'members', 'hierarchy', 'ideology',
  'founded', 'faction', 'allies', 'rivals', 'purpose', 'goals', 'structure', 'ranks',
])

const WORLD_RULE_KEYS = new Set([
  'religion type', 'number of deities', 'origin country', 'major figures', 'propagation',
  'center of worship', 'openness to foreigners', 'conversion stance', 'method of worship',
  'dogmatism', 'magic mastery', 'aura mastery', 'power level', 'low-level usage',
  'medium usage', 'high usage', 'overuse consequences',
])

const TIMELINE_KEYS = new Set([
  'date', 'era', 'year', 'time', 'period', 'timeframe', 'event', 'start date', 'end date',
  'calendar type',
])

export function classifyCandidate(
  title: string,
  sourcePath: string,
  plainText: string,
  metadataFields: Record<string, string>,
  wordCount: number
): ImportEntityKind {
  const pathLower = sourcePath.toLowerCase().replace(/\\/g, '/')
  const pathSegments = pathLower.split('/').slice(0, -1)

  for (const seg of pathSegments) {
    if (/(manuscript|chapter|chapters|scenes|draft)/.test(seg)) return 'chapter'
    if (/(character|characters|cast|protagonist|npc)/.test(seg)) return 'character'
    if (/(location|locations|places|setting|settings|regions|cities)/.test(seg)) return 'location'
    if (/(organization|organizations|faction|factions|guild|guilds|clan|clans|group)/.test(seg)) return 'organization'
    if (/(magic|rule|rules|religion|system|systems|laws)/.test(seg)) return 'world_rule'
    if (/(codex|species|item|items|creature|creatures|language|encyclopedia|lore)/.test(seg)) return 'codex'
    if (/(wiki)/.test(seg)) return 'wiki'
    if (/(timeline|chronology|events|history)/.test(seg)) return 'timeline_event'
    if (/(note|notes|scratch|notepad)/.test(seg)) return 'note'
  }

  const trimmedTitle = title.trim()
  if (CHAPTER_HEADING_REGEX.test(trimmedTitle)) return 'chapter'
  if (/^characters?$/i.test(trimmedTitle) && /physical\s+(features|traits)/i.test(plainText)) {
    return 'note'
  }
  if (/\b(timeline|chronology|present time|new event|era of)\b/i.test(trimmedTitle)) {
    return 'timeline_event'
  }

  const metaKeys = Object.keys(metadataFields).map((k) => k.toLowerCase().trim())
  const charHits = metaKeys.filter((k) => CHAR_KEYS.has(k)).length
  const locHits = metaKeys.filter((k) => LOC_KEYS.has(k)).length
  const orgHits = metaKeys.filter((k) => ORG_KEYS.has(k)).length
  const ruleHits = metaKeys.filter((k) => WORLD_RULE_KEYS.has(k)).length
  const timeHits = metaKeys.filter((k) => TIMELINE_KEYS.has(k)).length

  const hasCharSheetHeadings =
    /\b(physical traits|physical features)\b/i.test(plainText) &&
    (/\bpersonality traits\b/i.test(plainText) || /\bdistinctive marks\s*:/i.test(plainText))

  if (hasCharSheetHeadings || (charHits >= 2 && charHits >= locHits && charHits >= orgHits && charHits >= ruleHits)) {
    return 'character'
  }

  const isWorldRuleTitle = /\b(magic|aura|power ranking|system|religion|lights|theology|laws)\b/i.test(trimmedTitle)
  const hasWorldRuleHeadings =
    /\b(theology|deities|dogmatism|practices, laws, customs|aura vs\. magic|costs|limitations|circle system|ring system|seven stars system)\b/i.test(
      plainText
    )
  if (ruleHits >= 2 || isWorldRuleTitle || hasWorldRuleHeadings) {
    return 'world_rule'
  }

  const isLocationTitle = /\b(continent|kingdom|empire|city|town|village|realm|forest|island|region|province|palace|academy)\b/i.test(
    trimmedTitle
  )
  const locHeadingCount = ['geography', 'government', 'history', 'climate', 'culture', 'landmarks'].filter((kw) =>
    new RegExp(`^\\s*${kw}\\s*$`, 'im').test(plainText)
  ).length
  if (locHits >= 2 || isLocationTitle || locHeadingCount >= 2) {
    return 'location'
  }

  if (orgHits >= 2 && orgHits > charHits && orgHits > locHits) return 'organization'
  if (timeHits >= 2 || (metaKeys.includes('calendar type') && wordCount < 250)) return 'timeline_event'

  if (charHits === 1 && wordCount < 150) return 'character'
  if (locHits === 1 && wordCount < 150) return 'location'

  const hasDialogue = /["“][^"”]{4,}["”]/.test(plainText)
  if (wordCount >= 120 || (hasDialogue && wordCount >= 40)) {
    return 'chapter'
  }

  return 'note'
}

export async function prepareImportFiles(
  files: File[],
  options: { smartSplit: boolean }
): Promise<PreparedImportBatch> {
  const warnings: string[] = []
  const parsedDocs: ParsedDocument[] = []
  let suggestedBookTitle = ''
  let rawFilesCount = 0

  const handleFileBytes = async (
    bytes: Uint8Array,
    fileName: string,
    sourcePath: string,
    depth = 0
  ) => {
    const fmt = getImportFormat(fileName)
    if (!fmt) {
      warnings.push(`Skipped unsupported file "${sourcePath}".`)
      return
    }

    if (fmt === 'zip') {
      if (depth > 1) {
        warnings.push(`Skipped deeply nested ZIP archive "${sourcePath}".`)
        return
      }
      if (!isZipBytes(bytes)) {
        warnings.push(`"${sourcePath}" is not a valid ZIP archive.`)
        return
      }
      if (!suggestedBookTitle) {
        suggestedBookTitle = cleanFileStem(fileName)
      }
      try {
        const entries = await readZipEntries(bytes)
        for (const entry of entries) {
          if (entry.warning) {
            warnings.push(`${entry.path}: ${entry.warning}`)
            continue
          }
          await handleFileBytes(entry.bytes, entry.name, entry.path, depth + 1)
        }
      } catch (err: any) {
        warnings.push(`Failed to unpack "${sourcePath}": ${err?.message || 'Unknown error'}`)
      }
      return
    }

    rawFilesCount++
    try {
      const doc = await parseDocumentBytes(bytes, fileName, sourcePath)
      parsedDocs.push(doc)
    } catch (err: any) {
      warnings.push(`Failed to parse "${sourcePath}": ${err?.message || 'Unknown error'}`)
    }
  }

  for (const file of files) {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    await handleFileBytes(bytes, file.name, relativePath, 0)
  }

  if (!suggestedBookTitle && files.length === 1) {
    suggestedBookTitle = cleanFileStem(files[0].name)
  }
  if (!suggestedBookTitle) {
    suggestedBookTitle = 'Imported Story'
  }

  const expandedDocs: ParsedDocument[] = []
  for (const doc of parsedDocs) {
    if (options.smartSplit) {
      expandedDocs.push(...splitDocumentIntoCandidates(doc))
    } else {
      expandedDocs.push(doc)
    }
  }

  const candidates: ImportCandidate[] = expandedDocs.map((doc, idx) => {
    const kind = classifyCandidate(
      doc.title,
      doc.sourcePath,
      doc.plainText,
      doc.metadataFields,
      doc.wordCount
    )
    const cleaned =
      kind === 'chapter'
        ? cleanChapterCandidateHeader(doc.title || 'Untitled', doc.html, doc.plainText)
        : { title: doc.title || 'Untitled', html: doc.html, plainText: doc.plainText }
    const cleanedWordCount = countWords(cleaned.plainText)
    const sortHint =
      kind === 'chapter'
        ? computeChapterOrderHint(cleaned.title, idx)
        : 200000 + IMPORT_ENTITY_KINDS.findIndex((k) => k.kind === kind) * 1000 + idx

    return {
      id: createCandidateId(),
      selected: true,
      title: cleaned.title || 'Untitled',
      kind,
      sourceFile: doc.sourcePath,
      format: doc.format,
      html: cleaned.html,
      plainText: cleaned.plainText,
      wordCount: cleanedWordCount,
      metadataFields: doc.metadataFields,
      preview: makePreview(cleaned.plainText),
      warnings: doc.warnings,
      sortHint,
    }
  })

  candidates.sort((a, b) => a.sortHint - b.sortHint)

  return {
    candidates,
    suggestedBookTitle,
    warnings,
    rawFilesCount,
  }
}

export interface ExtractedCharacterFields {
  nickname: string
  age: string
  gender: string
  appearance: string
  personality: string
  goals: string
  relationships: string
  notes: string
}

function pushUnique(arr: string[], value: string): void {
  const clean = value.trim()
  if (!clean) return
  if (!arr.includes(clean)) arr.push(clean)
}

export function extractCharacterFields(
  plainText: string,
  metadataFields: Record<string, string>,
  characterName?: string
): ExtractedCharacterFields {
  const nicknameKeys = new Set(['nickname', 'alias', 'aliases', 'title', 'also known as', 'aka', 'moniker'])
  const ageKeys = new Set(['age', 'birthday', 'birth date', 'born', 'date of birth'])
  const genderKeys = new Set(['gender', 'pronouns', 'sex'])
  const appearanceKeys = new Set([
    'appearance', 'physical description', 'physical appearance', 'looks', 'hair',
    'eyes', 'height', 'weight', 'build', 'skin', 'distinctive marks',
    'distinguishing features', 'clothing', 'attire',
  ])
  const personalityKeys = new Set([
    'personality', 'traits', 'temperament', 'flaws', 'virtues', 'habits', 'quirks',
    'fears', 'strengths', 'weaknesses', 'alignment', 'mbti',
  ])
  const goalKeys = new Set(['goals', 'goal', 'motivation', 'motivations', 'ambition', 'desire', 'objective', 'arc'])
  const relKeys = new Set(['relationships', 'family', 'friends', 'allies', 'enemies', 'romance', 'affiliations', 'relatives'])

  const consumedKeys = new Set<string>()
  const buckets: Record<keyof ExtractedCharacterFields, string[]> = {
    nickname: [],
    age: [],
    gender: [],
    appearance: [],
    personality: [],
    goals: [],
    relationships: [],
    notes: [],
  }

  for (const [rawKey, rawVal] of Object.entries(metadataFields)) {
    const keyLower = rawKey.toLowerCase().trim()
    const val = rawVal.trim()
    if (!val) continue

    if (nicknameKeys.has(keyLower)) {
      pushUnique(buckets.nickname, val)
      consumedKeys.add(keyLower)
    } else if (ageKeys.has(keyLower)) {
      pushUnique(buckets.age, keyLower === 'age' ? val : `${rawKey}: ${val}`)
      consumedKeys.add(keyLower)
    } else if (genderKeys.has(keyLower)) {
      pushUnique(buckets.gender, keyLower === 'gender' ? val : `${rawKey}: ${val}`)
      consumedKeys.add(keyLower)
    } else if (appearanceKeys.has(keyLower)) {
      pushUnique(buckets.appearance, keyLower === 'appearance' ? val : `${rawKey}: ${val}`)
      consumedKeys.add(keyLower)
    } else if (personalityKeys.has(keyLower)) {
      pushUnique(buckets.personality, keyLower === 'personality' ? val : `${rawKey}: ${val}`)
      consumedKeys.add(keyLower)
    } else if (goalKeys.has(keyLower)) {
      pushUnique(buckets.goals, keyLower === 'goals' || keyLower === 'goal' ? val : `${rawKey}: ${val}`)
      consumedKeys.add(keyLower)
    } else if (relKeys.has(keyLower)) {
      pushUnique(buckets.relationships, keyLower === 'relationships' ? val : `${rawKey}: ${val}`)
      consumedKeys.add(keyLower)
    }
  }

  const normalizedCharName = (characterName || '').trim().toLowerCase()
  let section: 'overview' | 'physical' | 'personality' | 'relationships' | 'none' = 'none'

  for (const rawBlock of plainText.split(/\n{2,}/)) {
    for (const rawLine of rawBlock.split('\n')) {
      const trimmed = rawLine.trim().replace(/^[-*•◦]\s+/, '').trim()
      if (!trimmed) continue
      const lower = trimmed.toLowerCase()

      if (normalizedCharName && lower === normalizedCharName) continue
      if (lower === 'overview') { section = 'overview'; continue }
      if (/^physical\s+(traits|features):?$/i.test(trimmed)) { section = 'physical'; continue }
      if (/^personality(\s+traits)?:?$/i.test(trimmed)) { section = 'personality'; continue }
      if (/^(relatives|relationships|links):?$/i.test(trimmed)) { section = 'relationships'; continue }
      if (/^see linked elements\.?$/i.test(trimmed)) continue

      const kv = trimmed.match(/^([A-Za-z][A-Za-z0-9\s\-/&()']{1,31})\s*:\s+(.+)$/)
      if (kv) {
        const kLower = kv[1].toLowerCase().trim()
        if (consumedKeys.has(kLower)) continue
        if (section === 'physical') {
          pushUnique(buckets.appearance, trimmed)
          continue
        }
        if (section === 'personality') {
          pushUnique(buckets.personality, trimmed)
          continue
        }
        if (section === 'relationships') {
          pushUnique(buckets.relationships, trimmed)
          continue
        }
        pushUnique(buckets.notes, trimmed)
        continue
      }

      if (section === 'personality') {
        pushUnique(buckets.personality, trimmed)
      } else if (section === 'physical') {
        pushUnique(buckets.appearance, trimmed)
      } else if (section === 'relationships') {
        pushUnique(buckets.relationships, trimmed)
      } else {
        pushUnique(buckets.notes, trimmed)
      }
    }
  }

  return {
    nickname: buckets.nickname.join(', '),
    age: buckets.age.join(', '),
    gender: buckets.gender.join(', '),
    appearance: buckets.appearance.join('\n'),
    personality: buckets.personality.join('\n'),
    goals: buckets.goals.join('\n'),
    relationships: buckets.relationships.join('\n'),
    notes: buckets.notes.join('\n\n'),
  }
}

export interface ExtractedLocationFields {
  description: string
  culture: string
  history: string
  notes: string
}

export function extractLocationFields(
  plainText: string,
  metadataFields: Record<string, string>,
  locationName?: string
): ExtractedLocationFields {
  const descKeys = new Set([
    'description', 'overview', 'summary', 'geography', 'climate', 'terrain',
    'atmosphere', 'landmarks', 'appearance', 'environment', 'flora', 'fauna',
  ])
  const cultureKeys = new Set([
    'culture', 'society', 'government', 'politics', 'religion', 'economy',
    'population', 'inhabitants', 'language', 'traditions', 'customs', 'architecture',
  ])
  const historyKeys = new Set(['history', 'lore', 'origin', 'origins', 'past', 'founding', 'timeline'])

  const consumedKeys = new Set<string>()
  const descParts: string[] = []
  const cultureParts: string[] = []
  const historyParts: string[] = []
  const noteParts: string[] = []

  for (const [rawKey, rawVal] of Object.entries(metadataFields)) {
    const keyLower = rawKey.toLowerCase().trim()
    const val = rawVal.trim()
    if (!val) continue

    if (descKeys.has(keyLower)) {
      pushUnique(descParts, keyLower === 'description' || keyLower === 'overview' ? val : `${rawKey}: ${val}`)
      consumedKeys.add(keyLower)
    } else if (cultureKeys.has(keyLower)) {
      pushUnique(cultureParts, keyLower === 'culture' ? val : `${rawKey}: ${val}`)
      consumedKeys.add(keyLower)
    } else if (historyKeys.has(keyLower)) {
      pushUnique(historyParts, keyLower === 'history' ? val : `${rawKey}: ${val}`)
      consumedKeys.add(keyLower)
    } else {
      pushUnique(noteParts, `${rawKey}: ${val}`)
    }
  }

  const normalizedLocName = (locationName || '').trim().toLowerCase()
  let section: 'description' | 'culture' | 'history' | 'none' = 'none'

  for (const para of plainText.split(/\n{2,}/)) {
    for (const rawLine of para.split('\n')) {
      const trimmed = rawLine.trim()
      if (!trimmed) continue
      const lower = trimmed.toLowerCase()
      if (normalizedLocName && lower === normalizedLocName) continue

      if (/^(overview|geography|climate|landmarks):?$/i.test(trimmed)) { section = 'description'; continue }
      if (/^(culture|government|society|economy):?$/i.test(trimmed)) { section = 'culture'; continue }
      if (/^(history|lore):?$/i.test(trimmed)) { section = 'history'; continue }

      const kv = trimmed.match(/^([A-Za-z][A-Za-z0-9\s\-/&()']{1,31})\s*:\s+(.+)$/)
      if (kv && consumedKeys.has(kv[1].toLowerCase().trim())) continue
      if (kv && noteParts.some((n) => n.toLowerCase().startsWith(kv[1].toLowerCase() + ':'))) continue

      if (section === 'description') pushUnique(descParts, trimmed)
      else if (section === 'culture') pushUnique(cultureParts, trimmed)
      else if (section === 'history') pushUnique(historyParts, trimmed)
      else pushUnique(noteParts, trimmed)
    }
  }

  let description = descParts.join('\n\n')
  let notes = noteParts.join('\n\n')
  if (!description && !cultureParts.length && !historyParts.length && plainText.trim()) {
    description = plainText.trim()
    notes = ''
  }

  return {
    description,
    culture: cultureParts.join('\n\n'),
    history: historyParts.join('\n\n'),
    notes,
  }
}

export function extractTimelineFields(
  plainText: string,
  metadataFields: Record<string, string>
): { event_date: string; description: string; notes: string } {
  const dateKey = Object.keys(metadataFields).find((k) => TIMELINE_KEYS.has(k.toLowerCase().trim()))
  const event_date = dateKey ? metadataFields[dateKey] : ''

  const summaryKey = Object.keys(metadataFields).find((k) =>
    ['description', 'summary', 'overview'].includes(k.toLowerCase().trim())
  )
  const trimmed = plainText.trim()
  const firstPara = trimmed.split(/\n{2,}/)[0] || ''
  const rawDesc = summaryKey ? metadataFields[summaryKey] : firstPara
  const description = rawDesc.length > 500 ? rawDesc.slice(0, 497).trimEnd() + '…' : rawDesc
  const notes = trimmed && trimmed !== description ? trimmed : ''

  return { event_date, description, notes }
}

export async function commitImportBatch(options: CommitImportOptions): Promise<CommitImportResult> {
  if (window.api.isMock) {
    throw new Error('Import requires the desktop app.')
  }

  let targetBookId = options.bookId
  let bookTitle = ''
  let createdBook: Book | undefined
  let shouldSyncActive = options.syncToActiveWorkspace

  if (options.createNewBook) {
    const book = (await window.api.books.create({
      userId: options.createNewBook.userId,
      title: options.createNewBook.title.trim() || 'Imported Story',
      genre: options.createNewBook.genre?.trim() || '',
      description: options.createNewBook.description?.trim() || '',
    })) as Book
    useWorkspaceStore.getState().addBook(book)
    createdBook = book
    targetBookId = book.id
    bookTitle = book.title
    shouldSyncActive = false
  } else {
    const existing = useWorkspaceStore.getState().books.find((b) => b.id === targetBookId)
    bookTitle = existing?.title || 'Book'
  }

  const selectedItems = options.items.filter((item) => item.selected)
  const importedCounts: Partial<Record<ImportEntityKind, number>> = {}
  const failed: CommitImportResult['failed'] = []
  let totalImported = 0

  const hasTimeline = selectedItems.some((item) => item.kind === 'timeline_event')
  let verseTimelineSortOrder = 0
  if (hasTimeline) {
    try {
      const existingEvents = (await window.api.verseTimeline.getByBook(targetBookId)) || []
      verseTimelineSortOrder = Array.isArray(existingEvents) ? existingEvents.length : 0
    } catch {
      verseTimelineSortOrder = 0
    }
  }

  const bumpCount = (kind: ImportEntityKind) => {
    importedCounts[kind] = (importedCounts[kind] || 0) + 1
    totalImported++
  }

  const workspace = useWorkspaceStore.getState()
  const storyBible = useStoryBibleStore.getState()

  for (let i = 0; i < selectedItems.length; i++) {
    const item = selectedItems[i]
    const cleanTitle = item.title.trim() || 'Untitled'
    options.onProgress?.(i + 1, selectedItems.length, cleanTitle)

    try {
      if (item.kind === 'chapter') {
        const created = (await window.api.chapters.create({
          bookId: targetBookId,
          title: cleanTitle,
        })) as Chapter
        const saved = await window.api.chapters.save({
          id: created.id,
          content: item.html,
          wordCount: item.wordCount,
        })
        if (shouldSyncActive) {
          workspace.addChapter({
            ...created,
            content: item.html,
            word_count: item.wordCount,
            updated_at: saved?.savedAt ?? created.updated_at,
          })
        }
        bumpCount('chapter')
      } else if (item.kind === 'character') {
        const created = (await window.api.characters.create({
          bookId: targetBookId,
          name: cleanTitle,
        })) as Character
        const fields = extractCharacterFields(item.plainText, item.metadataFields, cleanTitle)
        const updated = (await window.api.characters.update({
          id: created.id,
          ...fields,
        })) as Character | undefined
        if (shouldSyncActive) {
          workspace.addCharacter(updated || { ...created, ...fields })
        }
        bumpCount('character')
      } else if (item.kind === 'location') {
        const created = (await window.api.locations.create({
          bookId: targetBookId,
          name: cleanTitle,
        })) as Location
        const fields = extractLocationFields(item.plainText, item.metadataFields, cleanTitle)
        const updated = (await window.api.locations.update({
          id: created.id,
          ...fields,
        })) as Location | undefined
        if (shouldSyncActive) {
          workspace.addLocation(updated || { ...created, ...fields })
        }
        bumpCount('location')
      } else if (item.kind === 'organization') {
        const created = (await window.api.organizations.create({
          bookId: targetBookId,
          title: cleanTitle,
        })) as Organization
        const updated = (await window.api.organizations.update({
          id: created.id,
          content: item.html,
        })) as Organization | undefined
        if (shouldSyncActive) {
          workspace.addOrganization(updated || { ...created, content: item.html })
        }
        bumpCount('organization')
      } else if (item.kind === 'world_rule') {
        const created = (await window.api.worldRules.create({
          bookId: targetBookId,
          title: cleanTitle,
        })) as WorldRule
        const updated = (await window.api.worldRules.update({
          id: created.id,
          content: item.html,
        })) as WorldRule | undefined
        if (shouldSyncActive) {
          workspace.addWorldRule(updated || { ...created, content: item.html })
        }
        bumpCount('world_rule')
      } else if (item.kind === 'codex') {
        const created = (await window.api.codex.create({
          bookId: targetBookId,
          title: cleanTitle,
        })) as Codex
        const updated = (await window.api.codex.update({
          id: created.id,
          content: item.html,
        })) as Codex | undefined
        if (shouldSyncActive) {
          workspace.addCodex(updated || { ...created, content: item.html })
        }
        bumpCount('codex')
      } else if (item.kind === 'wiki') {
        const created = (await window.api.wiki.create({
          bookId: targetBookId,
          title: cleanTitle,
        })) as Wiki
        const updated = (await window.api.wiki.update({
          id: created.id,
          content: item.html,
        })) as Wiki | undefined
        if (shouldSyncActive) {
          workspace.addWiki(updated || { ...created, content: item.html })
        }
        bumpCount('wiki')
      } else if (item.kind === 'note') {
        const created = (await window.api.notes.create({
          bookId: targetBookId,
          title: cleanTitle,
        })) as Note
        const updated = (await window.api.notes.update({
          id: created.id,
          content: item.html,
        })) as Note | undefined
        if (shouldSyncActive) {
          workspace.addNote(updated || { ...created, content: item.html })
        }
        bumpCount('note')
      } else if (item.kind === 'timeline_event') {
        const fields = extractTimelineFields(item.plainText, item.metadataFields)
        const created = (await window.api.verseTimeline.create({
          book_id: targetBookId,
          title: cleanTitle,
          description: fields.description,
          event_date: fields.event_date,
          sort_order: verseTimelineSortOrder++,
          notes: fields.notes,
        })) as VerseTimelineEvent
        if (shouldSyncActive) {
          storyBible.addVerseTimelineEvent(created)
        }
        bumpCount('timeline_event')
      }
    } catch (err: any) {
      failed.push({
        title: cleanTitle,
        kind: item.kind,
        error: err?.message || 'Failed to save record.',
      })
    }
  }

  return {
    bookId: targetBookId,
    bookTitle,
    createdBook,
    importedCounts,
    totalImported,
    failed,
  }
}

export function formatImportSummaryToast(result: CommitImportResult): string {
  const parts: string[] = []
  for (const meta of IMPORT_ENTITY_KINDS) {
    const count = result.importedCounts[meta.kind] || 0
    if (count > 0) {
      parts.push(`${count} ${count === 1 ? meta.label.toLowerCase() : meta.pluralLabel.toLowerCase()}`)
    }
  }
  const summary = parts.length > 0 ? parts.join(', ') : `${result.totalImported} items`
  return `Imported ${summary} into "${result.bookTitle}".`
}
