import { IpcMain } from 'electron'
import { dbRun, dbGet } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerAuthHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('auth:storeUser', async (_event, user: {
    id: string; email: string; username?: string; displayName?: string; avatarUrl?: string
  }) => {
    const now = new Date().toISOString()
    const existing = dbGet('SELECT id FROM users WHERE id = ?', [user.id])

    if (existing) {
      // Fetch existing user to preserve avatar if not provided in the update
      const existingUser = dbGet('SELECT avatar_url FROM users WHERE id = ?', [user.id]);
      const newAvatarUrl = user.avatarUrl !== undefined ? user.avatarUrl : existingUser.avatar_url;

      dbRun(
        'UPDATE users SET email = ?, username = ?, display_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
        [user.email, user.username ?? null, user.displayName ?? null, newAvatarUrl, now, user.id]
      )
    } else {
      dbRun(
        `INSERT INTO users (id, email, username, display_name, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user.id, user.email, user.username ?? null, user.displayName ?? null, user.avatarUrl ?? null, now, now]
      )
      // Initialize settings row
      const settingsExists = dbGet('SELECT id FROM settings WHERE user_id = ?', [user.id])
      if (!settingsExists) {
        dbRun(
          'INSERT INTO settings (id, user_id, created_at) VALUES (?, ?, ?)',
          [uuidv4(), user.id, now]
        )
      }
    }

    return dbGet('SELECT * FROM users WHERE id = ?', [user.id])
  })

  ipcMain.handle('auth:getStoredUser', async (_event, userId: string) => {
    return dbGet('SELECT * FROM users WHERE id = ?', [userId])
  })
}
