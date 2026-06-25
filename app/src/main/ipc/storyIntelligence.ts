import { ipcMain } from 'electron'
import { dbGet, dbAll, dbRun } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerStoryIntelligenceHandlers() {
  // --- story_analysis ---
  ipcMain.handle('storyIntelligence:getStoryAnalysis', async (_event, bookId: string) => {
    return dbGet('SELECT * FROM story_analysis WHERE book_id = ?', [bookId])
  })

  ipcMain.handle('storyIntelligence:upsertStoryAnalysis', async (_event, data: any) => {
    const existing = dbGet('SELECT id FROM story_analysis WHERE book_id = ?', [data.book_id]) as any
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        `UPDATE story_analysis SET 
          fatigue_warning = ?, repetition_warning = ?, updated_at = ? 
         WHERE book_id = ?`,
        [data.fatigue_warning || '', data.repetition_warning || '', now, data.book_id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        `INSERT INTO story_analysis (id, book_id, fatigue_warning, repetition_warning, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, data.book_id, data.fatigue_warning || '', data.repetition_warning || '', now, now]
      )
    }
    return dbGet('SELECT * FROM story_analysis WHERE book_id = ?', [data.book_id])
  })

  // --- arc_analysis ---
  ipcMain.handle('storyIntelligence:getArcAnalysis', async (_event, bookId: string) => {
    return dbAll('SELECT * FROM arc_analysis WHERE book_id = ?', [bookId])
  })

  ipcMain.handle('storyIntelligence:upsertArcAnalysis', async (_event, data: any) => {
    const existing = dbGet('SELECT id FROM arc_analysis WHERE character_id = ? AND book_id = ?', [data.character_id, data.book_id]) as any
    const now = new Date().toISOString()

    if (existing) {
      dbRun(
        `UPDATE arc_analysis SET 
          arc_status = ?, emotional_change = ?, updated_at = ? 
         WHERE id = ?`,
        [data.arc_status || '', data.emotional_change || '', now, existing.id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        `INSERT INTO arc_analysis (id, character_id, book_id, arc_status, emotional_change, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, data.character_id, data.book_id, data.arc_status || '', data.emotional_change || '', now, now]
      )
    }
    return dbGet('SELECT * FROM arc_analysis WHERE character_id = ? AND book_id = ?', [data.character_id, data.book_id])
  })

  // --- pacing_analysis ---
  ipcMain.handle('storyIntelligence:getPacingAnalysis', async (_event, bookId: string) => {
    return dbGet('SELECT * FROM pacing_analysis WHERE book_id = ?', [bookId])
  })

  ipcMain.handle('storyIntelligence:upsertPacingAnalysis', async (_event, data: any) => {
    const existing = dbGet('SELECT id FROM pacing_analysis WHERE book_id = ?', [data.book_id]) as any
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        `UPDATE pacing_analysis SET 
          pacing_status = ?, conflict_density = ?, updated_at = ? 
         WHERE book_id = ?`,
        [data.pacing_status || '', data.conflict_density || '', now, data.book_id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        `INSERT INTO pacing_analysis (id, book_id, pacing_status, conflict_density, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, data.book_id, data.pacing_status || '', data.conflict_density || '', now, now]
      )
    }
    return dbGet('SELECT * FROM pacing_analysis WHERE book_id = ?', [data.book_id])
  })

  // --- emotion_analysis ---
  ipcMain.handle('storyIntelligence:getEmotionAnalysis', async (_event, bookId: string) => {
    return dbGet('SELECT * FROM emotion_analysis WHERE book_id = ?', [bookId])
  })

  ipcMain.handle('storyIntelligence:upsertEmotionAnalysis', async (_event, data: any) => {
    const existing = dbGet('SELECT id FROM emotion_analysis WHERE book_id = ?', [data.book_id]) as any
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        `UPDATE emotion_analysis SET 
          emotional_flow_status = ?, warning = ?, updated_at = ? 
         WHERE book_id = ?`,
        [data.emotional_flow_status || '', data.warning || '', now, data.book_id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        `INSERT INTO emotion_analysis (id, book_id, emotional_flow_status, warning, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, data.book_id, data.emotional_flow_status || '', data.warning || '', now, now]
      )
    }
    return dbGet('SELECT * FROM emotion_analysis WHERE book_id = ?', [data.book_id])
  })

  // --- chapter_statistics ---
  ipcMain.handle('storyIntelligence:getChapterStatistics', async (_event, bookId: string) => {
    // We get all statistics for a book by joining with chapters
    return dbAll(
      `SELECT cs.* FROM chapter_statistics cs 
       JOIN chapters c ON cs.chapter_id = c.id 
       WHERE c.book_id = ?`, 
      [bookId]
    )
  })

  ipcMain.handle('storyIntelligence:upsertChapterStatistics', async (_event, data: any) => {
    const existing = dbGet('SELECT id FROM chapter_statistics WHERE chapter_id = ?', [data.chapter_id]) as any
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        `UPDATE chapter_statistics SET 
          repetition_warnings = ?, scene_density = ?, updated_at = ? 
         WHERE chapter_id = ?`,
        [data.repetition_warnings || '', data.scene_density || '', now, data.chapter_id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        `INSERT INTO chapter_statistics (id, chapter_id, repetition_warnings, scene_density, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, data.chapter_id, data.repetition_warnings || '', data.scene_density || '', now, now]
      )
    }
    return dbGet('SELECT * FROM chapter_statistics WHERE chapter_id = ?', [data.chapter_id])
  })
}
