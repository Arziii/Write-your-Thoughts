import type { IpcMain } from 'electron'
import { Parser } from 'htmlparser2'
import { dbAll } from '../database/init'
import { createSearchPattern, MAX_SEARCH_LENGTH } from '../../shared/manuscriptSearch'
import type { SearchRequest, SearchResult, SearchResultType } from '../../shared/manuscriptSearch'
import type { LocationChapterReference } from '../../shared/maps'

interface SearchSource {
  type: SearchResultType
  table: string
  title?: string
  fields: string[]
  richText?: boolean
  orderBy?: string
}

const sources: SearchSource[] = [
  { type: 'chapter', table: 'chapters', fields: ['content'], richText: true, orderBy: 'chapter_order' },
  { type: 'character', table: 'characters', title: 'name',
    fields: ['nickname', 'age', 'gender', 'appearance', 'personality', 'goals', 'relationships', 'notes'] },
  { type: 'location', table: 'locations', title: 'name',
    fields: ['description', 'culture', 'history', 'notes'] },
  { type: 'wiki', table: 'wiki', fields: ['content'], richText: true },
  { type: 'note', table: 'notes', fields: ['content'], richText: true },
  { type: 'codex', table: 'codex', fields: ['content'], richText: true },
  { type: 'organization', table: 'organizations', fields: ['content'], richText: true },
  { type: 'world_rule', table: 'world_rules', fields: ['content'], richText: true },
  { type: 'timeline', table: 'timeline_events', fields: ['description', 'notes'], orderBy: 'story_day' },
]

const blockTags = new Set([
  'article', 'blockquote', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'ol', 'p', 'pre', 'section', 'table', 'td', 'th', 'tr', 'ul',
])

function visibleText(html: string): string {
  let text = ''
  let hidden = false
  const parser = new Parser({
    onopentag(name) {
      if (name === 'script' || name === 'style') hidden = true
      if (name === 'br' || name === 'hr' || blockTags.has(name)) text += '\n'
    },
    ontext(value) {
      if (!hidden) text += value.replace(/[\t\r\n\f]/g, ' ')
    },
    onclosetag(name) {
      if (name === 'script' || name === 'style') hidden = false
      if (blockTags.has(name)) text += '\n'
    },
  })
  parser.end(html)
  return text
}

function getSnippet(text: string, index: number, match: string): SearchResult['snippet'] {
  const end = index + match.length
  const lineStart = index === 0 ? 0 : text.lastIndexOf('\n', index - 1) + 1
  const nextLine = text.indexOf('\n', end)
  const lineEnd = nextLine < 0 ? text.length : nextLine
  const start = Math.max(lineStart, index - 52)
  const stop = Math.min(lineEnd, end + 72)
  return {
    before: (start > lineStart ? '…' : '') + text.slice(start, index).trimStart(),
    match,
    after: text.slice(end, stop).trimEnd() + (stop < lineEnd ? '…' : ''),
  }
}

function findMatches(text: string, pattern: RegExp) {
  let count = 0
  let snippet: SearchResult['snippet'] | undefined
  pattern.lastIndex = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    snippet ??= getSnippet(text, match.index, match[0])
    count++
  }
  return { count, snippet }
}

export function registerSearchHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('search:locationReferences', (_event, locationId: string): LocationChapterReference[] => {
    const location = dbAll('SELECT name, book_id FROM locations WHERE id = ?', [locationId])[0]
    const name = typeof location?.name === 'string' ? location.name.trim() : ''
    if (!name || name.length > MAX_SEARCH_LENGTH) return []

    const namePattern = createSearchPattern(name)
    const boundary = '[\\p{L}\\p{N}_]'
    const pattern = new RegExp(`(?<!${boundary})${namePattern.source}(?!${boundary})`, namePattern.flags)
    const chapters = dbAll(
      'SELECT id, title, content FROM chapters WHERE book_id = ? ORDER BY chapter_order, id',
      [location.book_id]
    )
    return chapters.flatMap(chapter => {
      const title = String(chapter.title ?? '')
      const content = visibleText(String(chapter.content ?? ''))
      const excerpts: Array<{ text: string; score: number }> = []
      let previousEnd = -1
      pattern.lastIndex = 0
      for (let match = pattern.exec(content); match; match = pattern.exec(content)) {
        if (match.index < previousEnd) continue
        const start = Math.max(0, match.index - 160)
        const end = Math.min(content.length, match.index + match[0].length + 240)
        const text = (start > 0 ? '…' : '') + content.slice(start, end).replace(/\s+/g, ' ').trim() + (end < content.length ? '…' : '')
        const score = (text.match(/\b(?:govern\w*|rul(?:er|es|ed)|mayor|council|king|queen|culture|custom\w*|tradition\w*|founded|capital|history|religion|festival|province|district)\b/gi) ?? []).length
        excerpts.push({ text, score })
        excerpts.sort((a, b) => b.score - a.score)
        if (excerpts.length > 2) excerpts.pop()
        previousEnd = end
      }
      pattern.lastIndex = 0
      if (!excerpts.length && !pattern.test(title)) return []
      return [{ chapterId: String(chapter.id), title, excerpts: excerpts.map(excerpt => excerpt.text) }]
    })
  })

  ipcMain.handle('search:global', (_event, request: SearchRequest): SearchResult[] => {
    if (typeof request?.bookId !== 'string' || typeof request.query !== 'string') return []
    const query = request.query.trim()
    if (!query || query.length > MAX_SEARCH_LENGTH) return []

    const pattern = createSearchPattern(query)
    const results: SearchResult[] = []

    for (const source of sources) {
      const titleColumn = source.title ?? 'title'
      const order = source.orderBy ? `${source.orderBy}, ` : ''
      const rows = dbAll(
        `SELECT id, ${titleColumn} AS title, ${source.fields.join(', ')}
         FROM ${source.table} WHERE book_id = ? ORDER BY ${order}title COLLATE NOCASE, id`,
        [request.bookId]
      )

      for (const row of rows) {
        const title = String(row.title ?? '')
        const titleMatch = findMatches(title, pattern)
        let matchCount = titleMatch.count
        let passage: SearchResult['snippet'] | undefined

        for (const field of source.fields) {
          const value = row[field]
          if (typeof value !== 'string' || !value) continue
          const match = findMatches(source.richText ? visibleText(value) : value, pattern)
          passage ??= match.snippet
          matchCount += match.count
        }

        const snippet = passage ?? titleMatch.snippet
        if (!snippet) continue
        results.push({
          id: String(row.id), type: source.type, title, snippet, matchCount,
          hasPassage: source.type === 'chapter' && Boolean(passage),
        })
      }
    }

    return results
  })
}
