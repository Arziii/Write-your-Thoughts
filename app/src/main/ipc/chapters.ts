import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerChapterHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('chapters:getByBook', async (_event, bookId: string) => {
    return dbAll(
      'SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_order ASC',
      [bookId]
    )
  })

  ipcMain.handle('chapters:getById', async (_event, chapterId: string) => {
    return dbGet('SELECT * FROM chapters WHERE id = ?', [chapterId])
  })

  ipcMain.handle('chapters:create', async (_event, data: { bookId: string; title: string }) => {
    const id = uuidv4()
    const now = new Date().toISOString()

    const maxOrderRow = dbGet(
      'SELECT MAX(chapter_order) as max_order FROM chapters WHERE book_id = ?',
      [data.bookId]
    )
    const nextOrder = ((maxOrderRow?.max_order as number | null) ?? -1) + 1

    dbRun(
      `INSERT INTO chapters (id, book_id, title, content, word_count, chapter_order, created_at, updated_at)
       VALUES (?, ?, ?, '', 0, ?, ?, ?)`,
      [id, data.bookId, data.title, nextOrder, now, now]
    )
    dbRun(
      `INSERT INTO chapter_versions (id, chapter_id, version_number, content, source, created_at)
       VALUES (?, ?, 1, '', 'manual', ?)`,
      [uuidv4(), id, now]
    )
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at)
       VALUES (?, 'chapter', ?, 'create', 'pending', ?)`,
      [uuidv4(), id, now]
    )
    return dbGet('SELECT * FROM chapters WHERE id = ?', [id])
  })

  ipcMain.handle('chapters:save', async (_event, data: {
    id: string; content: string; wordCount: number
  }) => {
    const now = new Date().toISOString()
    dbRun(
      'UPDATE chapters SET content = ?, word_count = ?, updated_at = ?, synced = 0 WHERE id = ?',
      [data.content, data.wordCount, now, data.id]
    )
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at)
       VALUES (?, 'chapter', ?, 'update', 'pending', ?)`,
      [uuidv4(), data.id, now]
    )
    return { success: true, savedAt: now }
  })

  ipcMain.handle('chapters:rename', async (_event, data: { id: string; title: string }) => {
    const now = new Date().toISOString()
    dbRun('UPDATE chapters SET title = ?, updated_at = ? WHERE id = ?', [data.title, now, data.id])
    return dbGet('SELECT * FROM chapters WHERE id = ?', [data.id])
  })

  ipcMain.handle('chapters:update', async (_event, data: {
    id: string; title?: string; content?: string; wordCount?: number; chapterOrder?: number; synced?: number; cloud_id?: string
  }) => {
    const chapter = dbGet('SELECT * FROM chapters WHERE id = ?', [data.id])
    if (!chapter) return null

    const now = new Date().toISOString()
    dbRun(
      'UPDATE chapters SET title = ?, content = ?, word_count = ?, chapter_order = ?, synced = ?, cloud_id = ?, updated_at = ? WHERE id = ?',
      [
        data.title ?? chapter.title,
        data.content ?? chapter.content,
        data.wordCount ?? chapter.word_count,
        data.chapterOrder ?? chapter.chapter_order,
        data.synced ?? chapter.synced,
        data.cloud_id ?? chapter.cloud_id,
        now,
        data.id
      ]
    )
    return dbGet('SELECT * FROM chapters WHERE id = ?', [data.id])
  })

  ipcMain.handle('chapters:delete', async (_event, chapterId: string) => {
    const now = new Date().toISOString()
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at)
       VALUES (?, 'chapter', ?, 'delete', 'pending', ?)`,
      [uuidv4(), chapterId, now]
    )
    dbRun('DELETE FROM chapters WHERE id = ?', [chapterId])
    return { success: true }
  })

  ipcMain.handle('chapters:reorder', async (_event, chapters: Array<{ id: string; order: number }>) => {
    for (const ch of chapters) {
      dbRun('UPDATE chapters SET chapter_order = ? WHERE id = ?', [ch.order, ch.id])
    }
    return { success: true }
  })

  ipcMain.handle('chapters:getVersions', async (_event, chapterId: string) => {
    return dbAll(
      'SELECT * FROM chapter_versions WHERE chapter_id = ? ORDER BY version_number DESC',
      [chapterId]
    )
  })

  ipcMain.handle('chapters:saveVersion', async (_event, data: {
    chapterId: string; content: string; source: string
  }) => {
    const now = new Date().toISOString()
    const maxVerRow = dbGet(
      'SELECT MAX(version_number) as max_ver FROM chapter_versions WHERE chapter_id = ?',
      [data.chapterId]
    )
    const nextVer = ((maxVerRow?.max_ver as number | null) ?? 0) + 1
    const id = uuidv4()
    dbRun(
      `INSERT INTO chapter_versions (id, chapter_id, version_number, content, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.chapterId, nextVer, data.content, data.source, now]
    )
    return dbGet('SELECT * FROM chapter_versions WHERE id = ?', [id])
  })

  ipcMain.handle('chapters:restoreVersion', async (_event, data: {
    chapterId: string; versionId: string
  }) => {
    const version = dbGet('SELECT * FROM chapter_versions WHERE id = ?', [data.versionId])
    if (!version) return { success: false, error: 'Version not found' }

    const now = new Date().toISOString()
    const content = version.content as string
    const wordCount = content.replace(/<[^>]*>/g, '').trim().split(/\s+/).filter(Boolean).length

    dbRun(
      'UPDATE chapters SET content = ?, word_count = ?, updated_at = ?, synced = 0 WHERE id = ?',
      [content, wordCount, now, data.chapterId]
    )

    const maxVerRow = dbGet(
      'SELECT MAX(version_number) as max_ver FROM chapter_versions WHERE chapter_id = ?',
      [data.chapterId]
    )
    const nextVer = ((maxVerRow?.max_ver as number | null) ?? 0) + 1
    dbRun(
      `INSERT INTO chapter_versions (id, chapter_id, version_number, content, source, created_at)
       VALUES (?, ?, ?, ?, 'restore', ?)`,
      [uuidv4(), data.chapterId, nextVer, content, now]
    )

    return { success: true }
  })
}
