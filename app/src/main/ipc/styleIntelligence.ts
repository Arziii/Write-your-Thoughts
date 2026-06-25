import { IpcMain } from 'electron'
import { dbRun, dbGet } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerStyleIntelligenceHandlers(ipcMain: IpcMain): void {
  // Style Profiles
  ipcMain.handle('styleProfiles:getByBook', async (_, bookId: string) => {
    return await dbGet('SELECT * FROM style_profiles WHERE book_id = ?', [bookId])
  })

  ipcMain.handle('styleProfiles:upsert', async (_, data: any) => {
    const existing = await dbGet('SELECT id FROM style_profiles WHERE book_id = ?', [data.book_id])
    if (existing) {
      await dbRun(
        `UPDATE style_profiles SET 
          sentence_length = ?, dialogue_ratio = ?, vocabulary = ?, tone = ?, prose_density = ?, updated_at = datetime('now')
         WHERE book_id = ?`,
        [data.sentence_length, data.dialogue_ratio, data.vocabulary, data.tone, data.prose_density, data.book_id]
      )
      return await dbGet('SELECT * FROM style_profiles WHERE book_id = ?', [data.book_id])
    } else {
      const id = uuidv4()
      await dbRun(
        `INSERT INTO style_profiles (id, book_id, sentence_length, dialogue_ratio, vocabulary, tone, prose_density)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, data.book_id, data.sentence_length, data.dialogue_ratio, data.vocabulary, data.tone, data.prose_density]
      )
      return await dbGet('SELECT * FROM style_profiles WHERE id = ?', [id])
    }
  })

  // Chapter Metrics
  ipcMain.handle('chapterMetrics:getByChapter', async (_, chapterId: string) => {
    return await dbGet('SELECT * FROM chapter_metrics WHERE chapter_id = ?', [chapterId])
  })

  ipcMain.handle('chapterMetrics:upsert', async (_, data: any) => {
    const existing = await dbGet('SELECT id FROM chapter_metrics WHERE chapter_id = ?', [data.chapter_id])
    if (existing) {
      await dbRun(
        `UPDATE chapter_metrics SET 
          sentence_length = ?, dialogue_ratio = ?, vocabulary = ?, tone = ?, prose_density = ?, warning = ?, updated_at = datetime('now')
         WHERE chapter_id = ?`,
        [data.sentence_length, data.dialogue_ratio, data.vocabulary, data.tone, data.prose_density, data.warning, data.chapter_id]
      )
      return await dbGet('SELECT * FROM chapter_metrics WHERE chapter_id = ?', [data.chapter_id])
    } else {
      const id = uuidv4()
      await dbRun(
        `INSERT INTO chapter_metrics (id, chapter_id, sentence_length, dialogue_ratio, vocabulary, tone, prose_density, warning)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, data.chapter_id, data.sentence_length, data.dialogue_ratio, data.vocabulary, data.tone, data.prose_density, data.warning]
      )
      return await dbGet('SELECT * FROM chapter_metrics WHERE id = ?', [id])
    }
  })
}
