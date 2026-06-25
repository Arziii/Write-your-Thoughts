import { IpcMain } from 'electron'
import { getDbPath, getDb, saveDb, initDatabase } from '../database/init'
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
}
