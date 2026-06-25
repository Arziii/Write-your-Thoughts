import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerStoryBibleHandlers(ipcMain: IpcMain): void {
  // Story Bible
  ipcMain.handle('storyBible:getByBook', async (_event, bookId: string) => {
    return dbGet('SELECT * FROM story_bibles WHERE book_id = ?', [bookId])
  })

  ipcMain.handle('storyBible:upsert', async (_event, data: any) => {
    const { book_id, global_context, themes, indexed_at } = data
    const existing = dbGet('SELECT id FROM story_bibles WHERE book_id = ?', [book_id])
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        'UPDATE story_bibles SET global_context = ?, themes = ?, indexed_at = ?, updated_at = ? WHERE book_id = ?',
        [global_context, themes, indexed_at, now, book_id]
      )
      return dbGet('SELECT * FROM story_bibles WHERE book_id = ?', [book_id])
    } else {
      const id = uuidv4()
      dbRun(
        'INSERT INTO story_bibles (id, book_id, global_context, themes, indexed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, book_id, global_context, themes, indexed_at, now, now]
      )
      return dbGet('SELECT * FROM story_bibles WHERE id = ?', [id])
    }
  })

  // Character Profiles
  ipcMain.handle('characterProfiles:getByCharacter', async (_event, characterId: string) => {
    return dbGet('SELECT * FROM character_profiles WHERE character_id = ?', [characterId])
  })

  ipcMain.handle('characterProfiles:upsert', async (_event, data: any) => {
    const { character_id, traits, personality, motivations, speech_style, indexed_at } = data
    const existing = dbGet('SELECT id FROM character_profiles WHERE character_id = ?', [character_id])
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        'UPDATE character_profiles SET traits = ?, personality = ?, motivations = ?, speech_style = ?, indexed_at = ?, updated_at = ? WHERE character_id = ?',
        [traits, personality, motivations, speech_style, indexed_at, now, character_id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        'INSERT INTO character_profiles (id, character_id, traits, personality, motivations, speech_style, indexed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, character_id, traits, personality, motivations, speech_style, indexed_at, now, now]
      )
    }
    return dbGet('SELECT * FROM character_profiles WHERE character_id = ?', [character_id])
  })

  // Location Profiles
  ipcMain.handle('locationProfiles:getByLocation', async (_event, locationId: string) => {
    return dbGet('SELECT * FROM location_profiles WHERE location_id = ?', [locationId])
  })

  ipcMain.handle('locationProfiles:upsert', async (_event, data: any) => {
    const { location_id, geography, history, culture, indexed_at } = data
    const existing = dbGet('SELECT id FROM location_profiles WHERE location_id = ?', [location_id])
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        'UPDATE location_profiles SET geography = ?, history = ?, culture = ?, indexed_at = ?, updated_at = ? WHERE location_id = ?',
        [geography, history, culture, indexed_at, now, location_id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        'INSERT INTO location_profiles (id, location_id, geography, history, culture, indexed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, location_id, geography, history, culture, indexed_at, now, now]
      )
    }
    return dbGet('SELECT * FROM location_profiles WHERE location_id = ?', [location_id])
  })

  // Organization Profiles
  ipcMain.handle('organizationProfiles:getByOrganization', async (_event, organizationId: string) => {
    return dbGet('SELECT * FROM organization_profiles WHERE organization_id = ?', [organizationId])
  })

  ipcMain.handle('organizationProfiles:upsert', async (_event, data: any) => {
    const { organization_id, hierarchy, goals, relationships, indexed_at } = data
    const existing = dbGet('SELECT id FROM organization_profiles WHERE organization_id = ?', [organization_id])
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        'UPDATE organization_profiles SET hierarchy = ?, goals = ?, relationships = ?, indexed_at = ?, updated_at = ? WHERE organization_id = ?',
        [hierarchy, goals, relationships, indexed_at, now, organization_id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        'INSERT INTO organization_profiles (id, organization_id, hierarchy, goals, relationships, indexed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, organization_id, hierarchy, goals, relationships, indexed_at, now, now]
      )
    }
    return dbGet('SELECT * FROM organization_profiles WHERE organization_id = ?', [organization_id])
  })

  // Lore Entries
  ipcMain.handle('loreEntries:getByCodex', async (_event, codexId: string) => {
    return dbGet('SELECT * FROM lore_entries WHERE codex_id = ?', [codexId])
  })

  ipcMain.handle('loreEntries:upsert', async (_event, data: any) => {
    const { codex_id, summary, facts, indexed_at } = data
    const existing = dbGet('SELECT id FROM lore_entries WHERE codex_id = ?', [codex_id])
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        'UPDATE lore_entries SET summary = ?, facts = ?, indexed_at = ?, updated_at = ? WHERE codex_id = ?',
        [summary, facts, indexed_at, now, codex_id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        'INSERT INTO lore_entries (id, codex_id, summary, facts, indexed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, codex_id, summary, facts, indexed_at, now, now]
      )
    }
    return dbGet('SELECT * FROM lore_entries WHERE codex_id = ?', [codex_id])
  })
}
