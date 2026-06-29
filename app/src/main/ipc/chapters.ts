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
    
    // We don't automatically insert a version on chapter creation anymore, because 
    // empty chapters don't need a snapshot until the user types something.
    
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
      'SELECT * FROM chapter_versions WHERE chapter_id = ? ORDER BY created_at DESC',
      [chapterId]
    )
  })

  ipcMain.handle('chapters:saveVersion', async (_event, data: {
    chapterId: string; userId: string; content: string; wordCount: number; snapshotType: 'auto' | 'milestone'; milestoneName?: string
  }) => {
    const now = new Date().toISOString()
    const id = uuidv4()
    
    // Check if we need to prune old 'auto' snapshots to prevent SQLite bloat
    if (data.snapshotType === 'auto') {
      const autos = dbAll('SELECT id FROM chapter_versions WHERE chapter_id = ? AND snapshot_type = ? ORDER BY created_at DESC', [data.chapterId, 'auto'])
      if (autos.length >= 20) {
        // Keep only the newest 19, delete the rest
        const toDelete = autos.slice(19).map((r: any) => r.id)
        for (const delId of toDelete) {
          dbRun('DELETE FROM chapter_versions WHERE id = ?', [delId])
        }
      }
    }

    const colsInfo = dbAll('PRAGMA table_info(chapter_versions)') as any[]
    const colNames = colsInfo.map(c => String(c.name).toLowerCase().trim())

    const insertCols: string[] = ['id', 'chapter_id', 'user_id', 'content', 'word_count', 'snapshot_type', 'milestone_name', 'created_at']
    const placeholders: string[] = ['?', '?', '?', '?', '?', '?', '?', '?']
    const values: any[] = [id, data.chapterId, data.userId, data.content, data.wordCount, data.snapshotType, data.milestoneName || null, now]

    // Support for legacy schemas that were never fully migrated
    if (colNames.includes('version_number')) {
      const maxRow = dbGet('SELECT MAX(version_number) as max_version FROM chapter_versions WHERE chapter_id = ?', [data.chapterId])
      const nextVersion = ((maxRow?.max_version as number | null) ?? 0) + 1
      insertCols.push('version_number')
      placeholders.push('?')
      values.push(nextVersion)
    }

    if (colNames.includes('source')) {
      insertCols.push('source')
      placeholders.push('?')
      values.push(data.snapshotType === 'auto' ? 'ai_polish' : 'manual')
    }

    dbRun(
      `INSERT INTO chapter_versions (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values
    )

    // If it's a milestone, queue it for cloud sync
    if (data.snapshotType === 'milestone') {
      dbRun(
        `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at)
         VALUES (?, 'chapter_version', ?, 'create', 'pending', ?)`,
        [uuidv4(), id, now]
      )
    }

    return dbGet('SELECT * FROM chapter_versions WHERE id = ?', [id])
  })

  ipcMain.handle('chapters:restoreVersion', async (_event, data: {
    chapterId: string; versionId: string; userId: string
  }) => {
    const version = dbGet('SELECT * FROM chapter_versions WHERE id = ?', [data.versionId])
    if (!version) return { success: false, error: 'Version not found' }

    const now = new Date().toISOString()
    const content = version.content as string
    const wordCount = version.word_count as number

    dbRun(
      'UPDATE chapters SET content = ?, word_count = ?, updated_at = ?, synced = 0 WHERE id = ?',
      [content, wordCount, now, data.chapterId]
    )
    
    dbRun(
      `INSERT INTO sync_queue (id, entity_type, entity_id, operation, status, created_at)
       VALUES (?, 'chapter', ?, 'update', 'pending', ?)`,
      [uuidv4(), data.chapterId, now]
    )

    // Create an auto snapshot of the current state before restore (just in case they regret the restore!)
    // Wait, let's just let the normal autosave handle it. Restoring overwrites the content directly.
    return { success: true, restoredContent: content, restoredWordCount: wordCount }
  })
}
