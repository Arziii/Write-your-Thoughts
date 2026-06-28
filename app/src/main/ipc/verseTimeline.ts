import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerVerseTimelineHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('verseTimeline:getByBook', async (_event, bookId: string) => {
    return dbAll('SELECT * FROM verse_timeline_events WHERE book_id = ? ORDER BY sort_order ASC, created_at ASC', [bookId])
  })

  ipcMain.handle('verseTimeline:getById', async (_event, id: string) => {
    return dbGet('SELECT * FROM verse_timeline_events WHERE id = ?', [id])
  })

  ipcMain.handle('verseTimeline:create', async (_event, data: any) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    
    dbRun(
      `INSERT INTO verse_timeline_events (
        id, book_id, title, description, event_date, sort_order, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        data.book_id, 
        data.title, 
        data.description || '', 
        data.event_date || '', 
        data.sort_order || 0,
        data.notes || '',
        now, 
        now
      ]
    )
    return dbGet('SELECT * FROM verse_timeline_events WHERE id = ?', [id])
  })

  ipcMain.handle('verseTimeline:update', async (_event, data: any) => {
    const now = new Date().toISOString()
    const { id, ...fields } = data
    const updates: string[] = ['updated_at = ?']
    const params: unknown[] = [now]
    
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.unshift(`${key} = ?`)
        params.unshift(value)
      }
    }
    
    params.push(id)
    dbRun(`UPDATE verse_timeline_events SET ${updates.join(', ')} WHERE id = ?`, params)
    return dbGet('SELECT * FROM verse_timeline_events WHERE id = ?', [id])
  })

  ipcMain.handle('verseTimeline:delete', async (_event, id: string) => {
    dbRun('DELETE FROM verse_timeline_events WHERE id = ?', [id])
    return { success: true }
  })
}
