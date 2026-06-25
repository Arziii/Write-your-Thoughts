import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerOrganizationsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('organizations:getByBook', async (_event, bookId: string) => {
    return dbAll('SELECT * FROM organizations WHERE book_id = ? ORDER BY updated_at DESC', [bookId])
  })

  ipcMain.handle('organizations:getById', async (_event, id: string) => {
    return dbGet('SELECT * FROM organizations WHERE id = ?', [id])
  })

  ipcMain.handle('organizations:create', async (_event, data: { bookId: string; title: string }) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    dbRun(
      `INSERT INTO organizations (id, book_id, title, content, created_at, updated_at) VALUES (?, ?, ?, '', ?, ?)`,
      [id, data.bookId, data.title, now, now]
    )
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at) VALUES (?, 'organizations', ?, 'create', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    return dbGet('SELECT * FROM organizations WHERE id = ?', [id])
  })

  ipcMain.handle('organizations:update', async (_event, data: any) => {
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
    dbRun(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`, params)
    
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at) VALUES (?, 'organizations', ?, 'update', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    
    return dbGet('SELECT * FROM organizations WHERE id = ?', [id])
  })

  ipcMain.handle('organizations:delete', async (_event, id: string) => {
    const now = new Date().toISOString()
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at) VALUES (?, 'organizations', ?, 'delete', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    dbRun('DELETE FROM organizations WHERE id = ?', [id])
    return { success: true }
  })
}
