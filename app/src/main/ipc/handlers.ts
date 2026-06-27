import { IpcMain } from 'electron'
import { dbRun } from '../database/init'
import { registerBookHandlers } from './books'
import { registerChapterHandlers } from './chapters'
import { registerEditorHandlers } from './editor'
import { registerAuthHandlers } from './auth'
import { registerSettingsHandlers } from './settings'
import { registerCharacterHandlers } from './characters'
import { registerLocationHandlers } from './locations'
import { registerNoteHandlers } from './notes'
import { registerTimelineHandlers } from './timeline'
import { registerSearchHandlers } from './search'
import { registerExportHandlers } from './export'
import { registerPluginHandlers } from './plugins'
import { registerCommentHandlers } from './comments'
import { registerCodexHandlers } from './codex'
import { registerWikiHandlers } from './wiki'
import { registerOrganizationsHandlers } from './organizations'
import { registerWorldRulesHandlers } from './worldRules'
import { registerStoryBibleHandlers } from './storyBible'
import { registerCharacterVoiceHandlers } from './characterVoice'
import { registerEmotionalIntelligenceHandlers } from './emotionalIntelligence'
import { registerContinuityHandlers } from './continuityEngine'
import { registerStyleIntelligenceHandlers } from './styleIntelligence'
import { setupRelationshipHandlers } from './relationships'
import { registerVerseTimelineHandlers } from './verseTimeline'
import { registerStoryIntelligenceHandlers } from './storyIntelligence'
import { registerDatabaseHandlers } from './database'

export function registerIpcHandlers(ipcMain: IpcMain): void {
  registerDatabaseHandlers(ipcMain)
  registerAuthHandlers(ipcMain)
  registerBookHandlers(ipcMain)
  registerChapterHandlers(ipcMain)
  registerEditorHandlers(ipcMain)
  registerSettingsHandlers(ipcMain)
  registerCharacterHandlers(ipcMain)
  registerLocationHandlers(ipcMain)
  registerNoteHandlers(ipcMain)
  registerTimelineHandlers(ipcMain)
  registerSearchHandlers(ipcMain)
  registerExportHandlers(ipcMain)
  registerPluginHandlers(ipcMain)
  registerCommentHandlers(ipcMain)
  registerCodexHandlers(ipcMain)
  registerWikiHandlers(ipcMain)
  registerOrganizationsHandlers(ipcMain)
  registerWorldRulesHandlers(ipcMain)
  registerStoryBibleHandlers(ipcMain)
  registerCharacterVoiceHandlers(ipcMain)
  registerEmotionalIntelligenceHandlers(ipcMain)
  registerContinuityHandlers(ipcMain)
  registerStyleIntelligenceHandlers(ipcMain)
  setupRelationshipHandlers()
  registerVerseTimelineHandlers(ipcMain)
  registerStoryIntelligenceHandlers(ipcMain)

  ipcMain.handle('entities:reorder', async (_event, data: { table: string, items: Array<{ id: string; sort_order: number }> }) => {
    const allowedTables = ['codex', 'characters', 'locations', 'notes', 'organizations', 'world_rules', 'wiki']
    if (!allowedTables.includes(data.table)) {
      throw new Error('Invalid table name for reordering')
    }
    for (const item of data.items) {
      dbRun(`UPDATE ${data.table} SET sort_order = ? WHERE id = ?`, [item.sort_order, item.id])
    }
    return { success: true }
  })
}
