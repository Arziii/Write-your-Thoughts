import { IpcMain } from 'electron'
import { dbAll } from '../database/init'

export function registerSearchHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('search:global', async (_event, data: { bookId: string; query: string }) => {
    const { bookId, query } = data
    const searchTerm = `%${query}%`

    const results: Array<{ id: string; type: string; title: string; preview: string }> = []

    // Chapters
    const chapters = dbAll(
      'SELECT id, title, content FROM chapters WHERE book_id = ? AND (title LIKE ? OR content LIKE ?)',
      [bookId, searchTerm, searchTerm]
    )
    for (const c of chapters) {
      results.push({
        id: c.id as string,
        type: 'chapter',
        title: c.title as string,
        preview: getPreview(c.content as string, query)
      })
    }

    // Characters
    const characters = dbAll(
      'SELECT id, name, notes, appearance, personality FROM characters WHERE book_id = ? AND (name LIKE ? OR notes LIKE ? OR appearance LIKE ? OR personality LIKE ?)',
      [bookId, searchTerm, searchTerm, searchTerm, searchTerm]
    )
    for (const c of characters) {
      results.push({
        id: c.id as string,
        type: 'character',
        title: c.name as string,
        preview: getPreview((c.notes || c.appearance || c.personality || '') as string, query)
      })
    }

    // Locations
    const locations = dbAll(
      'SELECT id, name, description, notes FROM locations WHERE book_id = ? AND (name LIKE ? OR description LIKE ? OR notes LIKE ?)',
      [bookId, searchTerm, searchTerm, searchTerm]
    )
    for (const l of locations) {
      results.push({
        id: l.id as string,
        type: 'location',
        title: l.name as string,
        preview: getPreview((l.description || l.notes || '') as string, query)
      })
    }

    // Notes
    const notes = dbAll(
      'SELECT id, title, content FROM notes WHERE book_id = ? AND (title LIKE ? OR content LIKE ?)',
      [bookId, searchTerm, searchTerm]
    )
    for (const n of notes) {
      results.push({
        id: n.id as string,
        type: 'note',
        title: n.title as string,
        preview: getPreview(n.content as string, query)
      })
    }

    // Timeline Events
    const timelineEvents = dbAll(
      'SELECT id, title, description, notes FROM timeline_events WHERE book_id = ? AND (title LIKE ? OR description LIKE ? OR notes LIKE ?)',
      [bookId, searchTerm, searchTerm, searchTerm]
    )
    for (const te of timelineEvents) {
      results.push({
        id: te.id as string,
        type: 'timeline',
        title: te.title as string,
        preview: getPreview((te.description || te.notes || '') as string, query)
      })
    }

    return results
  })
}

function getPreview(text: string, query: string): string {
  if (!text) return ''
  // Strip HTML tags
  const plainText = text.replace(/<[^>]*>/g, '')
  const index = plainText.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return plainText.substring(0, 100) + '...'
  
  const start = Math.max(0, index - 40)
  const end = Math.min(plainText.length, index + query.length + 40)
  return (start > 0 ? '...' : '') + plainText.substring(start, end) + (end < plainText.length ? '...' : '')
}
