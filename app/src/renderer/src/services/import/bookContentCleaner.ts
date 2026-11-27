import { discardEditorSaves } from '../../hooks/useEditorSave'
import { scheduleCloudSync } from '../syncService'
import { refreshPendingSync } from '../../stores/cloudSyncStore'
import { useStoryBibleStore } from '../../stores/storyBibleStore'
import { useWorkspaceStore } from '../../stores/workspaceStore'

export type ClearableCategory =
  | 'chapters'
  | 'characters'
  | 'locations'
  | 'organizations'
  | 'world_rules'
  | 'codex'
  | 'wiki'
  | 'notes'
  | 'timeline_events'

export interface ClearableCategoryMeta {
  key: ClearableCategory
  label: string
  singular: string
}

export const CLEARABLE_CATEGORIES: ClearableCategoryMeta[] = [
  { key: 'chapters', label: 'Chapters', singular: 'chapter' },
  { key: 'characters', label: 'Characters', singular: 'character' },
  { key: 'locations', label: 'Locations', singular: 'location' },
  { key: 'organizations', label: 'Organizations', singular: 'organization' },
  { key: 'world_rules', label: 'World Rules', singular: 'world rule' },
  { key: 'codex', label: 'Codex Entries', singular: 'codex entry' },
  { key: 'wiki', label: 'Wiki Pages', singular: 'wiki page' },
  { key: 'notes', label: 'Notes', singular: 'note' },
  { key: 'timeline_events', label: 'World History Events', singular: 'timeline event' },
]

export interface ClearBookContentResult {
  bookId: string
  bookTitle: string
  deletedCounts: Partial<Record<ClearableCategory, number>>
  totalDeleted: number
  failed: Array<{ category: ClearableCategory; id: string; error: string }>
}

async function fetchCategoryIds(bookId: string, category: ClearableCategory): Promise<string[]> {
  let rows: unknown = []
  try {
    switch (category) {
      case 'chapters':
        rows = await window.api.chapters.getByBook(bookId)
        break
      case 'characters':
        rows = await window.api.characters.getByBook(bookId)
        break
      case 'locations':
        rows = await window.api.locations.getByBook(bookId)
        break
      case 'organizations':
        rows = await window.api.organizations.getByBook(bookId)
        break
      case 'world_rules':
        rows = await window.api.worldRules.getByBook(bookId)
        break
      case 'codex':
        rows = await window.api.codex.getByBook(bookId)
        break
      case 'wiki':
        rows = await window.api.wiki.getByBook(bookId)
        break
      case 'notes':
        rows = await window.api.notes.getByBook(bookId)
        break
      case 'timeline_events':
        rows = await window.api.verseTimeline.getByBook(bookId)
        break
    }
  } catch {
    return []
  }

  if (!Array.isArray(rows)) return []
  return rows
    .map((r) => (r && typeof r === 'object' && 'id' in r ? String((r as { id: string }).id) : ''))
    .filter(Boolean)
}

export async function getBookCategoryCounts(
  bookId: string
): Promise<Record<ClearableCategory, number>> {
  const counts: Record<ClearableCategory, number> = {
    chapters: 0,
    characters: 0,
    locations: 0,
    organizations: 0,
    world_rules: 0,
    codex: 0,
    wiki: 0,
    notes: 0,
    timeline_events: 0,
  }

  if (window.api.isMock) return counts

  const results = await Promise.all(
    CLEARABLE_CATEGORIES.map(async (cat) => ({
      key: cat.key,
      count: (await fetchCategoryIds(bookId, cat.key)).length,
    }))
  )

  for (const r of results) {
    counts[r.key] = r.count
  }
  return counts
}

export async function clearBookContent(options: {
  bookId: string
  bookTitle: string
  categories: ClearableCategory[]
  syncToActiveWorkspace: boolean
  onProgress?: (done: number, total: number, label: string) => void
}): Promise<ClearBookContentResult> {
  if (window.api.isMock) {
    throw new Error('Clearing story content requires the desktop app.')
  }

  const queue: Array<{ category: ClearableCategory; label: string; id: string }> = []
  for (const catKey of options.categories) {
    const meta = CLEARABLE_CATEGORIES.find((m) => m.key === catKey)
    const ids = await fetchCategoryIds(options.bookId, catKey)
    for (const id of ids) {
      queue.push({ category: catKey, label: meta?.label || catKey, id })
    }
  }

  discardEditorSaves(queue.map((q) => q.id))

  const deletedCounts: Partial<Record<ClearableCategory, number>> = {}
  const failed: ClearBookContentResult['failed'] = []
  let totalDeleted = 0

  const workspace = useWorkspaceStore.getState()
  const storyBible = useStoryBibleStore.getState()

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]
    options.onProgress?.(i + 1, queue.length, item.label)

    try {
      switch (item.category) {
        case 'chapters':
          await window.api.chapters.delete(item.id)
          if (options.syncToActiveWorkspace) workspace.removeChapter(item.id)
          break
        case 'characters':
          await window.api.characters.delete(item.id)
          if (options.syncToActiveWorkspace) workspace.removeCharacter(item.id)
          break
        case 'locations':
          await window.api.locations.delete(item.id)
          if (options.syncToActiveWorkspace) workspace.removeLocation(item.id)
          break
        case 'organizations':
          await window.api.organizations.delete(item.id)
          if (options.syncToActiveWorkspace) workspace.removeOrganization(item.id)
          break
        case 'world_rules':
          await window.api.worldRules.delete(item.id)
          if (options.syncToActiveWorkspace) workspace.removeWorldRule(item.id)
          break
        case 'codex':
          await window.api.codex.delete(item.id)
          if (options.syncToActiveWorkspace) workspace.removeCodex(item.id)
          break
        case 'wiki':
          await window.api.wiki.delete(item.id)
          if (options.syncToActiveWorkspace) workspace.removeWiki(item.id)
          break
        case 'notes':
          await window.api.notes.delete(item.id)
          if (options.syncToActiveWorkspace) workspace.removeNote(item.id)
          break
        case 'timeline_events':
          await window.api.verseTimeline.delete(item.id)
          if (options.syncToActiveWorkspace) storyBible.removeVerseTimelineEvent(item.id)
          break
      }

      deletedCounts[item.category] = (deletedCounts[item.category] || 0) + 1
      totalDeleted++
    } catch (err: any) {
      failed.push({
        category: item.category,
        id: item.id,
        error: err?.message || 'Failed to delete item.',
      })
    }
  }

  if (totalDeleted > 0) {
    scheduleCloudSync()
    void refreshPendingSync()
  }

  return {
    bookId: options.bookId,
    bookTitle: options.bookTitle,
    deletedCounts,
    totalDeleted,
    failed,
  }
}
