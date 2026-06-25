import { IpcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function registerCharacterVoiceHandlers(ipcMain: IpcMain): void {
  // Voice Profile
  ipcMain.handle('characterVoice:getProfile', async (_event, characterId: string) => {
    return dbGet('SELECT * FROM character_voice_profiles WHERE character_id = ?', [characterId])
  })

  ipcMain.handle('characterVoice:upsertProfile', async (_event, data: any) => {
    const { character_id, vocabulary, sentence_length, formality, personality, mood, emotional_state } = data
    const existing = dbGet('SELECT id FROM character_voice_profiles WHERE character_id = ?', [character_id])
    const now = new Date().toISOString()
    
    if (existing) {
      dbRun(
        'UPDATE character_voice_profiles SET vocabulary = ?, sentence_length = ?, formality = ?, personality = ?, mood = ?, emotional_state = ?, updated_at = ? WHERE character_id = ?',
        [vocabulary, sentence_length, formality, personality, mood, emotional_state, now, character_id]
      )
    } else {
      const id = uuidv4()
      dbRun(
        'INSERT INTO character_voice_profiles (id, character_id, vocabulary, sentence_length, formality, personality, mood, emotional_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, character_id, vocabulary, sentence_length, formality, personality, mood, emotional_state, now, now]
      )
    }
    return dbGet('SELECT * FROM character_voice_profiles WHERE character_id = ?', [character_id])
  })

  // Speech Patterns
  ipcMain.handle('speechPatterns:getByCharacter', async (_event, characterId: string) => {
    return dbAll('SELECT * FROM speech_patterns WHERE character_id = ? ORDER BY created_at DESC', [characterId])
  })

  ipcMain.handle('speechPatterns:create', async (_event, data: { character_id: string; pattern_description: string }) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    dbRun(
      'INSERT INTO speech_patterns (id, character_id, pattern_description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, data.character_id, data.pattern_description, now, now]
    )
    return dbGet('SELECT * FROM speech_patterns WHERE id = ?', [id])
  })

  ipcMain.handle('speechPatterns:delete', async (_event, id: string) => {
    dbRun('DELETE FROM speech_patterns WHERE id = ?', [id])
    return { success: true }
  })

  // Dialogue Samples
  ipcMain.handle('dialogueSamples:getByCharacter', async (_event, characterId: string) => {
    return dbAll('SELECT * FROM dialogue_samples WHERE character_id = ? ORDER BY created_at DESC', [characterId])
  })

  ipcMain.handle('dialogueSamples:create', async (_event, data: { character_id: string; sample_text: string; context: string }) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    dbRun(
      'INSERT INTO dialogue_samples (id, character_id, sample_text, context, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.character_id, data.sample_text, data.context, now, now]
    )
    return dbGet('SELECT * FROM dialogue_samples WHERE id = ?', [id])
  })

  ipcMain.handle('dialogueSamples:delete', async (_event, id: string) => {
    dbRun('DELETE FROM dialogue_samples WHERE id = ?', [id])
    return { success: true }
  })
}
