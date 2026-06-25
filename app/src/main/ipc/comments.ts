import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerCommentHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('comments:getByChapter', async (_event, chapterId: string) => {
    return dbAll(
      'SELECT * FROM comments WHERE chapter_id = ? ORDER BY created_at ASC',
      [chapterId]
    )
  })

  ipcMain.handle('comments:create', async (_event, data: {
    chapterId: string; content: string; quote: string
  }) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    
    dbRun(
      `INSERT INTO comments (id, chapter_id, content, quote, resolved, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
      [id, data.chapterId, data.content, data.quote, now, now]
    )
    
    return dbGet('SELECT * FROM comments WHERE id = ?', [id])
  })

  ipcMain.handle('comments:resolve', async (_event, id: string) => {
    const now = new Date().toISOString()
    dbRun('UPDATE comments SET resolved = 1, updated_at = ? WHERE id = ?', [now, id])
    return dbGet('SELECT * FROM comments WHERE id = ?', [id])
  })

  ipcMain.handle('comments:delete', async (_event, id: string) => {
    dbRun('DELETE FROM comments WHERE id = ?', [id])
    return { success: true }
  })
}
