import { IpcMain } from 'electron'
import { getDbPath, getDb, saveDb, initDatabase, dbRun, dbGet, dbAll } from '../database/init'
import { readFileSync, writeFileSync } from 'fs'

export function registerDatabaseHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('database:getBuffer', async () => {
    saveDb() // ensure latest memory state is on disk
    const dbPath = getDbPath()
    if (!dbPath) throw new Error('Database path not initialized')
    return readFileSync(dbPath)
  })

  ipcMain.handle('database:restoreBuffer', async (_event, buffer: Uint8Array) => {
    const dbPath = getDbPath()
    if (!dbPath) throw new Error('Database path not initialized')
    
    // Write new buffer directly to disk
    writeFileSync(dbPath, Buffer.from(buffer))
    
    // Re-initialize database from the new disk file
    initDatabase()
    
    return true
  })

  ipcMain.handle('database:getPendingSync', async () => {
    return dbAll("SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY created_at ASC")
  })

  ipcMain.handle('database:markSyncComplete', async (_event, id: string) => {
    // Delete the task so the queue stays small
    dbRun("DELETE FROM sync_queue WHERE id = ?", [id])
    return { success: true }
  })

  ipcMain.handle('database:getEntityRow', async (_event, data: { entityType: string, entityId: string }) => {
    // Safely map entity type to actual table name to prevent SQL injection
    const typeToTable: Record<string, string> = {
      'book': 'books',
      'chapter': 'chapters',
      'character': 'characters',
      'location': 'locations',
      'note': 'notes',
      'codex': 'codex',
      'wiki': 'wiki',
      'organizations': 'organizations',
      'world_rules': 'world_rules'
    }
    
    const tableName = typeToTable[data.entityType]
    if (!tableName) return null
    
    return dbGet(`SELECT * FROM ${tableName} WHERE id = ?`, [data.entityId])
  })

  ipcMain.handle('database:upsertEntityRow', async (_event, data: { entityType: string, row: any }) => {
    const typeToTable: Record<string, string> = {
      'book': 'books',
      'chapter': 'chapters',
      'character': 'characters',
      'location': 'locations',
      'note': 'notes',
      'codex': 'codex',
      'wiki': 'wiki',
      'organizations': 'organizations',
      'world_rules': 'world_rules'
    }
    const tableName = typeToTable[data.entityType]
    if (!tableName || !data.row || !data.row.id) return false
    
    const tableInfo = dbAll(`PRAGMA table_info(${tableName})`) as { name: string }[]
    const validColumns = tableInfo.map(col => col.name)

    const keys = Object.keys(data.row).filter(k => k !== 'cloud_id' && validColumns.includes(k)) 
    const columns = keys.join(', ')
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map(k => data.row[k])
    
    // SQLite upsert
    dbRun(`INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`, values)
    return true
  })

  /**
   * Conflict-aware upsert for incoming cloud rows (Phase 3).
   */
  ipcMain.handle('database:upsertCloudRow', async (_event, data: { entityType: string, row: any }) => {
    const typeToTable: Record<string, string> = {
      'book': 'books',
      'chapter': 'chapters',
      'character': 'characters',
      'location': 'locations',
      'note': 'notes',
      'codex': 'codex',
      'wiki': 'wiki',
      'organizations': 'organizations',
      'world_rules': 'world_rules'
    }
    const tableName = typeToTable[data.entityType]
    if (!tableName || !data.row?.id) return { inserted: false, conflict: false }

    const cloudRow = data.row
    
    const tableInfo = dbAll(`PRAGMA table_info(${tableName})`) as { name: string }[]
    const validColumns = tableInfo.map(col => col.name)

    // Check if row exists locally
    const existing = dbGet(`SELECT updated_at FROM ${tableName} WHERE id = ?`, [cloudRow.id])

    if (existing && cloudRow.updated_at && existing.updated_at) {
      const localTime = new Date(existing.updated_at as string).getTime()
      const cloudTime = new Date(cloudRow.updated_at as string).getTime()

      // Conflict: local is NEWER than cloud (meaning it was edited offline on this device)
      if (localTime > cloudTime) {
        // Create a conflict-copy with a new ID so both survive
        const conflictId = `${cloudRow.id}_conflict_${Date.now()}`
        const conflictRow = { ...cloudRow, id: conflictId }
        if ('title' in conflictRow) conflictRow.title = `${conflictRow.title} [Cloud Conflict]`
        if ('name' in conflictRow) conflictRow.name = `${conflictRow.name} [Cloud Conflict]`

        const conflictKeys = Object.keys(conflictRow).filter(k => validColumns.includes(k))
        const conflictCols = conflictKeys.join(', ')
        const conflictPlaceholders = conflictKeys.map(() => '?').join(', ')
        const conflictValues = conflictKeys.map(k => conflictRow[k])
        dbRun(`INSERT OR IGNORE INTO ${tableName} (${conflictCols}) VALUES (${conflictPlaceholders})`, conflictValues)
        // Keep the local version as-is (don’t overwrite)
        return { inserted: true, conflict: true }
      }
    }

    // No conflict — safe to insert or overwrite with cloud version
    const keys = Object.keys(cloudRow).filter(k => validColumns.includes(k))
    const columns = keys.join(', ')
    const placeholders = keys.map(() => '?').join(', ')
    const values = keys.map(k => cloudRow[k])
    dbRun(`INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`, values)
    return { inserted: true, conflict: false }
  })
}
