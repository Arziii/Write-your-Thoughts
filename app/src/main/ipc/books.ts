import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerBookHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('books:getAll', async (_event, userId: string) => {
    return dbAll(
      'SELECT * FROM books WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    )
  })

  ipcMain.handle('books:getById', async (_event, bookId: string) => {
    return dbGet('SELECT * FROM books WHERE id = ?', [bookId])
  })

  ipcMain.handle('books:create', async (_event, data: {
    userId: string; title: string; authorName?: string; genre?: string; description?: string
  }) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    dbRun(
      `INSERT INTO books (id, user_id, title, author_name, genre, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'writing', ?, ?)`,
      [id, data.userId, data.title, data.authorName || '', data.genre || '', data.description || '', now, now]
    )
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at)
       VALUES (?, 'book', ?, 'create', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    return dbGet('SELECT * FROM books WHERE id = ?', [id])
  })

  ipcMain.handle('books:update', async (_event, data: {
    id: string; title?: string; authorName?: string; genre?: string; description?: string; status?: string; coverImage?: string; cloudId?: string
  }) => {
    const now = new Date().toISOString()
    const updates: string[] = ['updated_at = ?', 'synced = 0']
    const params: unknown[] = [now]

    if (data.title !== undefined) { updates.push('title = ?'); params.push(data.title); }
    if (data.authorName !== undefined) { updates.push('author_name = ?'); params.push(data.authorName); }
    if (data.genre !== undefined) { updates.push('genre = ?'); params.push(data.genre); }
    if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
    if (data.status !== undefined) { updates.push('status = ?'); params.push(data.status); }
    if (data.coverImage !== undefined) { updates.push('cover_image = ?'); params.push(data.coverImage); }
    if (data.cloudId !== undefined) { updates.push('cloud_id = ?'); params.push(data.cloudId); }

    params.push(data.id)
    dbRun(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`, params)
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at)
       VALUES (?, 'book', ?, 'update', 'pending', ?)`,
      [uuidv4(), data.id, now]
    )
    return dbGet('SELECT * FROM books WHERE id = ?', [data.id])
  })

  ipcMain.handle('books:delete', async (_event, bookId: string) => {
    const now = new Date().toISOString()
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at)
       VALUES (?, 'book', ?, 'delete', 'pending', ?)`,
      [uuidv4(), bookId, now]
    )
    dbRun('DELETE FROM books WHERE id = ?', [bookId])
    return { success: true }
  })
}
