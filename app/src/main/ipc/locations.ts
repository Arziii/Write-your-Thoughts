import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerLocationHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('locations:getByBook', async (_event, bookId: string) => {
    return dbAll('SELECT * FROM locations WHERE book_id = ? ORDER BY sort_order ASC, name ASC', [bookId])
  })

  ipcMain.handle('locations:getById', async (_event, id: string) => {
    return dbGet('SELECT * FROM locations WHERE id = ?', [id])
  })

  ipcMain.handle('locations:create', async (_event, data: { bookId: string; name: string }) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    dbRun(
      `INSERT INTO locations (id, book_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      [id, data.bookId, data.name, now, now]
    )
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at) VALUES (?, 'location', ?, 'create', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    return dbGet('SELECT * FROM locations WHERE id = ?', [id])
  })

  ipcMain.handle('locations:update', async (_event, data: any) => {
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
    dbRun(`UPDATE locations SET ${updates.join(', ')} WHERE id = ?`, params)
    
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at) VALUES (?, 'location', ?, 'update', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    
    return dbGet('SELECT * FROM locations WHERE id = ?', [id])
  })

  ipcMain.handle('locations:delete', async (_event, id: string) => {
    const now = new Date().toISOString()
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at) VALUES (?, 'location', ?, 'delete', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    dbRun('DELETE FROM locations WHERE id = ?', [id])
    return { success: true }
  })
}
