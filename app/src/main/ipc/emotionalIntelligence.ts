import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerEmotionalIntelligenceHandlers(ipcMain: IpcMain): void {
  // Chapter Emotions
  ipcMain.handle('chapterEmotions:getByChapter', async (_event, chapterId: string) => {
    return dbGet('SELECT * FROM chapter_emotions WHERE chapter_id = ?', [chapterId])
  })

  ipcMain.handle('chapterEmotions:upsert', async (_event, data: any) => {
    const { chapter_id, primary_emotion, secondary_emotion, intensity } = data
    const existing = dbGet('SELECT id FROM chapter_emotions WHERE chapter_id = ?', [chapter_id])
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        'UPDATE chapter_emotions SET primary_emotion = ?, secondary_emotion = ?, intensity = ?, updated_at = ? WHERE chapter_id = ?',
        [primary_emotion, secondary_emotion, intensity, now, chapter_id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        'INSERT INTO chapter_emotions (id, chapter_id, primary_emotion, secondary_emotion, intensity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, chapter_id, primary_emotion, secondary_emotion, intensity, now, now]
      )
    }
    return dbGet('SELECT * FROM chapter_emotions WHERE chapter_id = ?', [chapter_id])
  })

  // Scene Emotions
  ipcMain.handle('sceneEmotions:getByChapter', async (_event, chapterId: string) => {
    return dbAll('SELECT * FROM scene_emotions WHERE chapter_id = ? ORDER BY created_at ASC', [chapterId])
  })

  ipcMain.handle('sceneEmotions:create', async (_event, data: { chapter_id: string; scene_description: string; primary_emotion: string; intensity: number }) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    dbRun(
      'INSERT INTO scene_emotions (id, chapter_id, scene_description, primary_emotion, intensity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, data.chapter_id, data.scene_description, data.primary_emotion, data.intensity, now, now]
    )
    return dbGet('SELECT * FROM scene_emotions WHERE id = ?', [id])
  })

  ipcMain.handle('sceneEmotions:delete', async (_event, id: string) => {
    dbRun('DELETE FROM scene_emotions WHERE id = ?', [id])
    return { success: true }
  })
}
