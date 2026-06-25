import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerTimelineHandlers(ipcMain: IpcMain): void {
  // --- Settings ---
  ipcMain.handle('timelineSettings:get', async (_event, bookId: string) => {
    return dbGet('SELECT * FROM timeline_settings WHERE book_id = ?', [bookId])
  })

  ipcMain.handle('timelineSettings:upsert', async (_event, data: { book_id: string; start_date_string: string; calendar_system?: string }) => {
    const existing = dbGet('SELECT * FROM timeline_settings WHERE book_id = ?', [data.book_id])
    if (existing) {
      dbRun(
        'UPDATE timeline_settings SET start_date_string = ?, calendar_system = ? WHERE book_id = ?',
        [data.start_date_string, data.calendar_system || 'gregorian', data.book_id]
      )
    } else {
      dbRun(
        'INSERT INTO timeline_settings (book_id, start_date_string, calendar_system) VALUES (?, ?, ?)',
        [data.book_id, data.start_date_string, data.calendar_system || 'gregorian']
      )
    }
    return dbGet('SELECT * FROM timeline_settings WHERE book_id = ?', [data.book_id])
  })

  // --- Events ---
  ipcMain.handle('timeline:getByBook', async (_event, bookId: string) => {
    return dbAll('SELECT * FROM timeline_events WHERE book_id = ? ORDER BY story_day ASC, created_at ASC', [bookId])
  })

  ipcMain.handle('timeline:getById', async (_event, id: string) => {
    return dbGet('SELECT * FROM timeline_events WHERE id = ?', [id])
  })

  ipcMain.handle('timeline:create', async (_event, data: any) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    
    dbRun(
      `INSERT INTO timeline_events (
        id, book_id, title, description, story_day, duration_days, chapter_id, characters_involved, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        data.book_id, 
        data.title, 
        data.description || '', 
        data.story_day || 1, 
        data.duration_days || 1,
        data.chapter_id || null, 
        data.characters_involved ? JSON.stringify(data.characters_involved) : '[]',
        now, 
        now
      ]
    )
    return dbGet('SELECT * FROM timeline_events WHERE id = ?', [id])
  })

  ipcMain.handle('timeline:update', async (_event, data: any) => {
    const now = new Date().toISOString()
    const { id, ...fields } = data
    const updates: string[] = ['updated_at = ?']
    const params: unknown[] = [now]
    
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.unshift(`${key} = ?`)
        if (key === 'characters_involved' && typeof value !== 'string') {
          params.unshift(JSON.stringify(value))
        } else {
          params.unshift(value)
        }
      }
    }
    
    params.push(id)
    dbRun(`UPDATE timeline_events SET ${updates.join(', ')} WHERE id = ?`, params)
    return dbGet('SELECT * FROM timeline_events WHERE id = ?', [id])
  })

  ipcMain.handle('timeline:delete', async (_event, id: string) => {
    dbRun('DELETE FROM timeline_events WHERE id = ?', [id])
    return { success: true }
  })
}
