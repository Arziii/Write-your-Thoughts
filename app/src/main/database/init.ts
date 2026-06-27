import initSqlJs, { Database } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'

let db: Database | null = null
let dbPath: string = ''

export function getDb(): Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function getDbPath(): string {
  return dbPath
}

/** Persist the in-memory database back to disk */
export function saveDb(): void {
  if (!db || !dbPath) return
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

// ── Thin helpers that mimic better-sqlite3's synchronous API ────────

/** Run a statement with no return value, then auto-save */
export function dbRun(sql: string, params?: unknown[]): void {
  const database = getDb()
  database.run(sql, params as SqlJs.BindParams | undefined)
  saveDb()
}

/** Return the first row as a plain object, or undefined */
export function dbGet(sql: string, params?: unknown[]): Record<string, unknown> | undefined {
  const database = getDb()
  const stmt = database.prepare(sql)
  if (params) stmt.bind(params as SqlJs.BindParams)
  const found = stmt.step()
  const row = found ? (stmt.getAsObject() as Record<string, unknown>) : undefined
  stmt.free()
  return row
}

/** Return all matching rows as plain objects */
export function dbAll(sql: string, params?: unknown[]): Record<string, unknown>[] {
  const database = getDb()
  const stmt = database.prepare(sql)
  if (params) stmt.bind(params as SqlJs.BindParams)
  const rows: Record<string, unknown>[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as Record<string, unknown>)
  }
  stmt.free()
  return rows
}

// ── Init ─────────────────────────────────────────────────────────────

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'database')
  mkdirSync(dbDir, { recursive: true })
  dbPath = join(dbDir, 'write-your-thoughts.db')

  // sql.js needs its WASM file – locate it from node_modules
  const wasmPath = join(
    app.getAppPath(),
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm'
  )

  const SQL = await initSqlJs({ locateFile: () => wasmPath })

  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.run('PRAGMA foreign_keys = ON')
  createTables()
  saveDb()
}

// ── Schema ────────────────────────────────────────────────────────────

function createTables(): void {
  const database = getDb()

  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT,
      display_name TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      theme TEXT DEFAULT 'dark',
      accent_color TEXT DEFAULT 'indigo',
      editor_font TEXT DEFAULT 'Georgia',
      font_size INTEGER DEFAULT 16,
      line_spacing REAL DEFAULT 1.8,
      ai_provider TEXT DEFAULT 'openai',
      ai_api_key TEXT,
      ai_style_prompt TEXT DEFAULT '',
      preserve_formatting INTEGER DEFAULT 0,
      autosave_interval INTEGER DEFAULT 3000,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      author_name TEXT DEFAULT '',
      genre TEXT DEFAULT '',
      description TEXT DEFAULT '',
      cover_image TEXT,
      status TEXT DEFAULT 'writing',
      synced INTEGER DEFAULT 0,
      cloud_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS chapters (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      word_count INTEGER DEFAULT 0,
      chapter_order INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      cloud_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS chapter_versions (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS workspace_state (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      current_book_id TEXT,
      current_chapter_id TEXT,
      cursor_position INTEGER DEFAULT 0,
      scroll_position INTEGER DEFAULT 0,
      open_tabs TEXT DEFAULT '[]',
      panel_state TEXT DEFAULT '{"sidebarOpen":true,"aiPanelOpen":true}',
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      name TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      age TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      appearance TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      goals TEXT DEFAULT '',
      relationships TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      image_url TEXT,
      sort_order INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      culture TEXT DEFAULT '',
      history TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      image_url TEXT,
      sort_order INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS codex (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS wiki (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      event_date TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      content TEXT NOT NULL,
      quote TEXT DEFAULT '',
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    )
  `)

  // --- PHASE 7 User Facing Tables ---
  database.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS world_rules (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      synced INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  // --- PHASE 7 AI Intelligence Layer Tables ---
  database.run(`
    CREATE TABLE IF NOT EXISTS story_bibles (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL UNIQUE,
      global_context TEXT DEFAULT '',
      themes TEXT DEFAULT '',
      indexed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS character_profiles (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL UNIQUE,
      traits TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      motivations TEXT DEFAULT '',
      speech_style TEXT DEFAULT '',
      indexed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS location_profiles (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL UNIQUE,
      geography TEXT DEFAULT '',
      history TEXT DEFAULT '',
      culture TEXT DEFAULT '',
      indexed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS organization_profiles (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL UNIQUE,
      hierarchy TEXT DEFAULT '',
      goals TEXT DEFAULT '',
      relationships TEXT DEFAULT '',
      indexed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS lore_entries (
      id TEXT PRIMARY KEY,
      codex_id TEXT NOT NULL UNIQUE,
      summary TEXT DEFAULT '',
      facts TEXT DEFAULT '',
      indexed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (codex_id) REFERENCES codex(id) ON DELETE CASCADE
    )
  `)

  // --- PHASE 8 AI Voice Intelligence Tables ---
  database.run(`
    CREATE TABLE IF NOT EXISTS character_voice_profiles (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL UNIQUE,
      vocabulary TEXT DEFAULT '',
      sentence_length TEXT DEFAULT '',
      formality TEXT DEFAULT '',
      personality TEXT DEFAULT '',
      mood TEXT DEFAULT '',
      emotional_state TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS speech_patterns (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      pattern_description TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS dialogue_samples (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      sample_text TEXT NOT NULL,
      context TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `)

  // --- PHASE 9 EMOTIONAL INTELLIGENCE Tables ---
  database.run(`
    CREATE TABLE IF NOT EXISTS chapter_emotions (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL UNIQUE,
      primary_emotion TEXT DEFAULT '',
      secondary_emotion TEXT DEFAULT '',
      intensity INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS scene_emotions (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      scene_description TEXT DEFAULT '',
      primary_emotion TEXT DEFAULT '',
      intensity INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    )
  `)

  // --- PHASE 10 CONTINUITY ENGINE Tables ---
  database.run(`
    CREATE TABLE IF NOT EXISTS continuity_events (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      description TEXT NOT NULL,
      event_type TEXT DEFAULT 'General',
      entity_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS continuity_warnings (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL,
      warning_description TEXT NOT NULL,
      severity TEXT DEFAULT 'Medium',
      resolved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    )
  `)

  // --- PHASE 11 STYLE INTELLIGENCE Tables ---
  database.run(`
    CREATE TABLE IF NOT EXISTS style_profiles (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL UNIQUE,
      sentence_length TEXT DEFAULT '',
      dialogue_ratio TEXT DEFAULT '',
      vocabulary TEXT DEFAULT '',
      tone TEXT DEFAULT '',
      prose_density TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS chapter_metrics (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL UNIQUE,
      sentence_length TEXT DEFAULT '',
      dialogue_ratio TEXT DEFAULT '',
      vocabulary TEXT DEFAULT '',
      tone TEXT DEFAULT '',
      prose_density TEXT DEFAULT '',
      warning TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    )
  `)
  // --- PHASE 12 RELATIONSHIP INTELLIGENCE Tables ---
  database.run(`
    CREATE TABLE IF NOT EXISTS character_relationships (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      source_character_id TEXT NOT NULL,
      target_character_id TEXT NOT NULL,
      relationship_type TEXT DEFAULT 'Neutral',
      trust_level INTEGER DEFAULT 5,
      affection_level INTEGER DEFAULT 5,
      history TEXT DEFAULT '',
      current_state TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (source_character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (target_character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS relationship_events (
      id TEXT PRIMARY KEY,
      relationship_id TEXT NOT NULL,
      chapter_id TEXT,
      event_description TEXT NOT NULL,
      impact_on_trust INTEGER DEFAULT 0,
      impact_on_affection INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (relationship_id) REFERENCES character_relationships(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS relationship_states (
      id TEXT PRIMARY KEY,
      relationship_id TEXT NOT NULL,
      chapter_id TEXT NOT NULL,
      trust_level_at_chapter INTEGER DEFAULT 5,
      affection_level_at_chapter INTEGER DEFAULT 5,
      state_notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (relationship_id) REFERENCES character_relationships(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
      UNIQUE(relationship_id, chapter_id)
    )
  `)

  // --- PHASE 13 TIMELINE INTELLIGENCE Tables ---
  database.run(`
    CREATE TABLE IF NOT EXISTS timeline_settings (
      book_id TEXT PRIMARY KEY,
      start_date_string TEXT DEFAULT '',
      calendar_system TEXT DEFAULT 'gregorian',
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS timeline_events (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      story_day INTEGER DEFAULT 1,
      chapter_id TEXT,
      characters_involved TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL
    )
  `)

  // --- PHASE 14 STORY INTELLIGENCE Tables ---
  database.run(`
    CREATE TABLE IF NOT EXISTS story_analysis (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL UNIQUE,
      fatigue_warning TEXT DEFAULT '',
      repetition_warning TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS arc_analysis (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      arc_status TEXT DEFAULT '',
      emotional_change TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS pacing_analysis (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL UNIQUE,
      pacing_status TEXT DEFAULT '',
      conflict_density TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS emotion_analysis (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL UNIQUE,
      emotional_flow_status TEXT DEFAULT '',
      warning TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `)

  database.run(`
    CREATE TABLE IF NOT EXISTS chapter_statistics (
      id TEXT PRIMARY KEY,
      chapter_id TEXT NOT NULL UNIQUE,
      repetition_warnings TEXT DEFAULT '',
      scene_density TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
    )
  `)

  // Migrations for existing databases
  try {
    database.run(`ALTER TABLE settings ADD COLUMN ai_style_prompt TEXT DEFAULT ''`)
  } catch (e) {
    // Column might already exist
  }
  
  try {
    database.run(`ALTER TABLE settings ADD COLUMN preserve_formatting INTEGER DEFAULT 0`)
  } catch (e) {
    // Column might already exist
  }

  try {
    database.run(`ALTER TABLE books ADD COLUMN author_name TEXT DEFAULT ''`)
  } catch (e) {
    // Column might already exist
  }

  // Phase 13 Migrations for timeline_events
  try {
    database.run(`ALTER TABLE timeline_events ADD COLUMN story_day INTEGER DEFAULT 1`)
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error adding story_day:', e)
    }
  }
  
  try {
    database.run(`ALTER TABLE timeline_events ADD COLUMN chapter_id TEXT`)
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error adding chapter_id:', e)
    }
  }

  try {
    database.run(`ALTER TABLE timeline_events ADD COLUMN characters_involved TEXT`)
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error adding characters_involved:', e)
    }
  }

  try {
    database.run(`ALTER TABLE timeline_events ADD COLUMN duration_days INTEGER DEFAULT 1`)
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      console.error('Migration error adding duration_days:', e)
    }
  }

  // Phase 15 Migrations for sort_order
  const tablesWithSortOrder = ['codex', 'characters', 'locations', 'notes', 'organizations', 'world_rules', 'wiki']
  for (const table of tablesWithSortOrder) {
    try {
      database.run(`ALTER TABLE ${table} ADD COLUMN sort_order INTEGER DEFAULT 0`)
    } catch (e: any) {
      if (!e.message.includes('duplicate column name')) {
        console.error(`Migration error adding sort_order to ${table}:`, e)
      }
    }
  }
}
