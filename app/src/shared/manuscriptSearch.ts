export const MAX_SEARCH_LENGTH = 200

export type SearchResultType = 'chapter' | 'character' | 'location' | 'note' | 'timeline'
  | 'codex' | 'wiki' | 'organization' | 'world_rule'

export interface SearchRequest {
  bookId: string
  query: string
}

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  matchCount: number
  hasPassage: boolean
  snippet: {
    before: string
    match: string
    after: string
  }
}

export type SearchTarget =
  | { type: 'chapter'; chapterId: string; query: string }
  | { type: 'timeline'; eventId: string }

export function createSearchPattern(query: string): RegExp {
  const words = query.trim().split(/\s+/)
  const escapedWords = words.map(word => word.replace(/[$.*+?^{}()|[\]\\]/g, '\\$&'))
  return new RegExp(escapedWords.join('[^\\S\\r\\n]+'), 'giu')
}
