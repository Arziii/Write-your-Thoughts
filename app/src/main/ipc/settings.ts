import { IpcMain } from 'electron'
import { dbRun, dbGet } from '../database/init'

export function registerSettingsHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('settings:get', async (_event, userId: string) => {
    return dbGet('SELECT * FROM settings WHERE user_id = ?', [userId])
  })

  ipcMain.handle('settings:update', async (_event, data: {
    userId: string; theme?: string; accentColor?: string; editorFont?: string
    fontSize?: number; lineSpacing?: number; aiProvider?: string; aiApiKey?: string
    aiStylePrompt?: string; preserveFormatting?: boolean
    autosaveInterval?: number
  }) => {
    const updates: string[] = []
    const params: unknown[] = []

    if (data.theme !== undefined) { updates.push('theme = ?'); params.push(data.theme) }
    if (data.accentColor !== undefined) { updates.push('accent_color = ?'); params.push(data.accentColor) }
    if (data.editorFont !== undefined) { updates.push('editor_font = ?'); params.push(data.editorFont) }
    if (data.fontSize !== undefined) { updates.push('font_size = ?'); params.push(data.fontSize) }
    if (data.lineSpacing !== undefined) { updates.push('line_spacing = ?'); params.push(data.lineSpacing) }
    if (data.aiProvider !== undefined) { updates.push('ai_provider = ?'); params.push(data.aiProvider) }
    if (data.aiApiKey !== undefined) { updates.push('ai_api_key = ?'); params.push(data.aiApiKey) }
    if (data.aiStylePrompt !== undefined) { updates.push('ai_style_prompt = ?'); params.push(data.aiStylePrompt) }
    if (data.preserveFormatting !== undefined) { updates.push('preserve_formatting = ?'); params.push(data.preserveFormatting ? 1 : 0) }
    if (data.autosaveInterval !== undefined) { updates.push('autosave_interval = ?'); params.push(data.autosaveInterval) }

    if (updates.length > 0) {
      params.push(data.userId)
      dbRun(`UPDATE settings SET ${updates.join(', ')} WHERE user_id = ?`, params)
    }

    return dbGet('SELECT * FROM settings WHERE user_id = ?', [data.userId])
  })
}
