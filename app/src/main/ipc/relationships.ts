import { ipcMain } from 'electron'
import { dbRun, dbGet, dbAll } from '../database/init'
import { v4 as uuidv4 } from 'uuid'

export function setupRelationshipHandlers() {
  // --- Character Relationships ---
  ipcMain.handle('relationships:getByBook', (_, bookId: string) => {
    try {
      return dbAll('SELECT * FROM character_relationships WHERE book_id = ? ORDER BY updated_at DESC', [bookId])
    } catch (error) {
      console.error('Failed to get character relationships', error)
      throw error
    }
  })

  ipcMain.handle('relationships:upsert', (_, rel: any) => {
    try {
      if (rel.id) {
        dbRun(`
          UPDATE character_relationships 
          SET source_character_id = ?, target_character_id = ?, relationship_type = ?, 
              trust_level = ?, affection_level = ?, history = ?, current_state = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [rel.source_character_id, rel.target_character_id, rel.relationship_type, rel.trust_level, rel.affection_level, rel.history, rel.current_state, rel.id])
        return dbGet('SELECT * FROM character_relationships WHERE id = ?', [rel.id])
      } else {
        const id = uuidv4()
        dbRun(`
          INSERT INTO character_relationships (id, book_id, source_character_id, target_character_id, relationship_type, trust_level, affection_level, history, current_state)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [id, rel.book_id, rel.source_character_id, rel.target_character_id, rel.relationship_type, rel.trust_level, rel.affection_level, rel.history, rel.current_state])
        return dbGet('SELECT * FROM character_relationships WHERE id = ?', [id])
      }
    } catch (error) {
      console.error('Failed to upsert relationship', error)
      throw error
    }
  })

  ipcMain.handle('relationships:delete', (_, id: string) => {
    try {
      dbRun('DELETE FROM character_relationships WHERE id = ?', [id])
      return true
    } catch (error) {
      console.error('Failed to delete relationship', error)
      throw error
    }
  })

  // --- Relationship Events ---
  ipcMain.handle('relationshipEvents:getByRelationship', (_, relationshipId: string) => {
    try {
      return dbAll('SELECT * FROM relationship_events WHERE relationship_id = ? ORDER BY created_at ASC', [relationshipId])
    } catch (error) {
      console.error('Failed to get relationship events', error)
      throw error
    }
  })

  ipcMain.handle('relationshipEvents:create', (_, ev: any) => {
    try {
      const id = uuidv4()
      dbRun(`
        INSERT INTO relationship_events (id, relationship_id, chapter_id, event_description, impact_on_trust, impact_on_affection)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [id, ev.relationship_id, ev.chapter_id || null, ev.event_description, ev.impact_on_trust || 0, ev.impact_on_affection || 0])
      return dbGet('SELECT * FROM relationship_events WHERE id = ?', [id])
    } catch (error) {
      console.error('Failed to create relationship event', error)
      throw error
    }
  })

  ipcMain.handle('relationshipEvents:delete', (_, id: string) => {
    try {
      dbRun('DELETE FROM relationship_events WHERE id = ?', [id])
      return true
    } catch (error) {
      console.error('Failed to delete relationship event', error)
      throw error
    }
  })

  // --- Relationship States ---
  ipcMain.handle('relationshipStates:getByRelationship', (_, relationshipId: string) => {
    try {
      return dbAll('SELECT * FROM relationship_states WHERE relationship_id = ? ORDER BY created_at ASC', [relationshipId])
    } catch (error) {
      console.error('Failed to get relationship states', error)
      throw error
    }
  })

  ipcMain.handle('relationshipStates:upsert', (_, state: any) => {
    try {
      if (state.id) {
        dbRun(`
          UPDATE relationship_states 
          SET trust_level_at_chapter = ?, affection_level_at_chapter = ?, state_notes = ?, updated_at = datetime('now')
          WHERE id = ?
        `, [state.trust_level_at_chapter, state.affection_level_at_chapter, state.state_notes, state.id])
        return dbGet('SELECT * FROM relationship_states WHERE id = ?', [state.id])
      } else {
        const id = uuidv4()
        dbRun(`
          INSERT INTO relationship_states (id, relationship_id, chapter_id, trust_level_at_chapter, affection_level_at_chapter, state_notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [id, state.relationship_id, state.chapter_id, state.trust_level_at_chapter, state.affection_level_at_chapter, state.state_notes])
        return dbGet('SELECT * FROM relationship_states WHERE id = ?', [id])
      }
    } catch (error) {
      console.error('Failed to upsert relationship state', error)
      throw error
    }
  })
}
