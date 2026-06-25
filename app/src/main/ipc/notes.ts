import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerNoteHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('notes:getByBook', async (_event, bookId: string) => {
    return dbAll('SELECT * FROM notes WHERE book_id = ? ORDER BY updated_at DESC', [bookId])
  })

  ipcMain.handle('notes:getById', async (_event, id: string) => {
    return dbGet('SELECT * FROM notes WHERE id = ?', [id])
  })

  ipcMain.handle('notes:create', async (_event, data: { bookId: string; title: string }) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    dbRun(
      `INSERT INTO notes (id, book_id, title, content, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?)`,
      [id, data.bookId, data.title, now, now]
    )
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at) VALUES (?, 'note', ?, 'create', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    return dbGet('SELECT * FROM notes WHERE id = ?', [id])
  })

  ipcMain.handle('notes:update', async (_event, data: any) => {
    const now = new Date().toISOString()
    const { id, ...fields } = data
    const updates: string[] = ['updated_at = ?', 'synced = 0']
    const params: unknown[] = [now]
    
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates.unshift(`${key} = ?`)
        params.unshift(value)
      }
    }
    
    params.push(id)
    dbRun(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`, params)
    
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at) VALUES (?, 'note', ?, 'update', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    
    return dbGet('SELECT * FROM notes WHERE id = ?', [id])
  })

  ipcMain.handle('notes:delete', async (_event, id: string) => {
    const now = new Date().toISOString()
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at) VALUES (?, 'note', ?, 'delete', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    dbRun('DELETE FROM notes WHERE id = ?', [id])
    return { success: true }
  })
}
