import { IpcMain } from 'electron'
import { dbRun, dbGet } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerEditorHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('editor:getWorkspaceState', async (_event, userId: string) => {
    return dbGet('SELECT * FROM workspace_state WHERE user_id = ?', [userId])
  })

  ipcMain.handle('editor:saveWorkspaceState', async (_event, data: {
    userId: string
    currentBookId?: string | null
    currentChapterId?: string | null
    cursorPosition?: number
    scrollPosition?: number
    openTabs?: string[]
    panelState?: { sidebarOpen: boolean; aiPanelOpen: boolean }
  }) => {
    const now = new Date().toISOString()
    const existing = dbGet('SELECT id FROM workspace_state WHERE user_id = ?', [data.userId])

    if (existing) {
      const updates: string[] = ['updated_at = ?']
      const params: unknown[] = [now]

      if (data.currentBookId !== undefined) { updates.push('current_book_id = ?'); params.push(data.currentBookId) }
      if (data.currentChapterId !== undefined) { updates.push('current_chapter_id = ?'); params.push(data.currentChapterId) }
      if (data.cursorPosition !== undefined) { updates.push('cursor_position = ?'); params.push(data.cursorPosition) }
      if (data.scrollPosition !== undefined) { updates.push('scroll_position = ?'); params.push(data.scrollPosition) }
      if (data.openTabs !== undefined) { updates.push('open_tabs = ?'); params.push(JSON.stringify(data.openTabs)) }
      if (data.panelState !== undefined) { updates.push('panel_state = ?'); params.push(JSON.stringify(data.panelState)) }

      params.push(data.userId)
      dbRun(`UPDATE workspace_state SET ${updates.join(', ')} WHERE user_id = ?`, params)
    } else {
      dbRun(
        `INSERT INTO workspace_state (id, user_id, current_book_id, current_chapter_id,
          cursor_position, scroll_position, open_tabs, panel_state, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          data.userId,
          data.currentBookId ?? null,
          data.currentChapterId ?? null,
          data.cursorPosition ?? 0,
          data.scrollPosition ?? 0,
          JSON.stringify(data.openTabs ?? []),
          JSON.stringify(data.panelState ?? { sidebarOpen: true, aiPanelOpen: true }),
          now,
        ]
      )
    }

    return dbGet('SELECT * FROM workspace_state WHERE user_id = ?', [data.userId])
  })
}
