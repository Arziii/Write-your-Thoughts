import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerContinuityHandlers(ipcMain: IpcMain): void {
  // Continuity Events
  ipcMain.handle('continuityEvents:getByChapter', async (_event, chapterId: string) => {
    return dbAll('SELECT * FROM continuity_events WHERE chapter_id = ? ORDER BY created_at ASC', [chapterId])
  })

  ipcMain.handle('continuityEvents:create', async (_event, data: { chapter_id: string; description: string; event_type?: string; entity_id?: string }) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    dbRun(
      'INSERT INTO continuity_events (id, chapter_id, description, event_type, entity_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.chapter_id, data.description, data.event_type || 'General', data.entity_id || null, now, now]
    )
    return dbGet('SELECT * FROM continuity_events WHERE id = ?', [id])
  })

  ipcMain.handle('continuityEvents:delete', async (_event, id: string) => {
    dbRun('DELETE FROM continuity_events WHERE id = ?', [id])
    return { success: true }
  })

  // Continuity Warnings
  ipcMain.handle('continuityWarnings:getByChapter', async (_event, chapterId: string) => {
    return dbAll('SELECT * FROM continuity_warnings WHERE chapter_id = ? ORDER BY created_at DESC', [chapterId])
  })

  ipcMain.handle('continuityWarnings:create', async (_event, data: { chapter_id: string; warning_description: string; severity?: string }) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    dbRun(
      'INSERT INTO continuity_warnings (id, chapter_id, warning_description, severity, resolved, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
      [id, data.chapter_id, data.warning_description, data.severity || 'Medium', now, now]
    )
    return dbGet('SELECT * FROM continuity_warnings WHERE id = ?', [id])
  })

  ipcMain.handle('continuityWarnings:resolve', async (_event, id: string) => {
    const now = new Date().toISOString()
    dbRun('UPDATE continuity_warnings SET resolved = 1, updated_at = ? WHERE id = ?', [now, id])
    return dbGet('SELECT * FROM continuity_warnings WHERE id = ?', [id])
  })

  ipcMain.handle('continuityWarnings:delete', async (_event, id: string) => {
    dbRun('DELETE FROM continuity_warnings WHERE id = ?', [id])
    return { success: true }
  })
}
