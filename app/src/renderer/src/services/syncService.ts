import { supabase } from './supabase'

// ── Debounced backup scheduler ──────────────────────────────────────────────
// Module-level timer: multiple rapid writes collapse into one upload.
let _backupTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Schedule a cloud backup that fires `delayMs` after the LAST call.
 * Safe to call on every keystroke / save — uploads only happen once the
 * user stops writing for `delayMs` milliseconds.
 */
export function scheduleSyncBackup(delayMs = 15_000): void {
  if (_backupTimer) clearTimeout(_backupTimer)
  _backupTimer = setTimeout(async () => {
    _backupTimer = null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await syncService.processSyncQueue()
        // We still trigger the full db backup occasionally, but the primary sync is granular
        await syncService.backupDatabaseToCloud()
      }
    } catch (e) {
      console.error('[Sync] Scheduled backup failed:', e)
    }
  }, delayMs)
}

// ── Main service ────────────────────────────────────────────────────────────

export const syncService = {

  /**
   * Returns metadata for the user's cloud backup file, including its
   * last-modified timestamp. Returns null if no backup exists yet.
   */
  async getCloudBackupInfo(): Promise<{ updatedAt: Date | null; size: number } | null> {
    const { data: { session } } = await supabase.auth.getSession()
    const userData = { user: session?.user }
    if (!userData.user) return null

    try {
      // List the user's backup directory — file is named write-your-thoughts.db
      const { data, error } = await supabase.storage
        .from('user_backups')
        .list(userData.user.id, { search: 'write-your-thoughts.db' })

      if (error || !data || data.length === 0) return null

      const file = data[0]
      // Supabase storage metadata uses updated_at or last_modified
      const rawDate = (file as any).updated_at || (file as any).last_modified || null
      return {
        updatedAt: rawDate ? new Date(rawDate) : null,
        size: (file.metadata as any)?.size ?? 0,
      }
    } catch {
      return null
    }
  },

  async publishBook(localBookId: string) {
    try {
      const book = await window.api.books.getById(localBookId)
      if (!book) throw new Error('Local book not found')

      const chapters = await window.api.chapters.getByBook(localBookId)
      
      const { data: { session } } = await supabase.auth.getSession()
      const userData = { user: session?.user }
      const userError = !session?.user ? new Error('Not logged in') : null
      if (userError || !userData.user) throw new Error('Must be logged in to publish')

      // 1. Create cloud book
      const { data: cloudBook, error: bookError } = await supabase
        .from('cloud_books')
        .insert({
          owner_id: userData.user.id,
          title: book.title,
          genre: book.genre,
          description: book.description
        })
        .select()
        .single()

      if (bookError) throw bookError

      // 2. Create cloud chapters
      if (chapters.length > 0) {
        const cloudChaptersData = chapters.map((c: any) => ({
          book_id: cloudBook.id,
          title: c.title,
          content: c.content,
          chapter_order: c.chapter_order
        }))

        const { data: cloudChapters, error: chaptersError } = await supabase
          .from('cloud_chapters')
          .insert(cloudChaptersData)
          .select()

        if (chaptersError) throw chaptersError

        // 3. Update local chapters with cloud_id
        for (let i = 0; i < chapters.length; i++) {
          const localChapter = chapters[i]
          const cloudChapter = cloudChapters.find(cc => cc.chapter_order === localChapter.chapter_order)
          if (cloudChapter) {
            await window.api.chapters.update({ ...localChapter, cloud_id: cloudChapter.id, synced: 1 })
          }
        }
      }

      // 4. Update local book with cloud_id
      await window.api.books.update({ ...book, cloud_id: cloudBook.id, synced: 1 })

      return { success: true, cloudId: cloudBook.id }
    } catch (err: any) {
      console.error('Publish error:', err)
      return { success: false, error: err.message }
    }
  },

  async lockChapter(cloudChapterId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    const userData = { user: session?.user }
    if (!userData.user) return false

    const { error } = await supabase
      .from('cloud_chapters')
      .update({ locked_by: userData.user.id, locked_at: new Date().toISOString() })
      .eq('id', cloudChapterId)
      // Only lock if it's not locked by someone else
      .is('locked_by', null)
      
    return !error
  },

  async unlockChapter(cloudChapterId: string) {
    const { data: { session } } = await supabase.auth.getSession()
    const userData = { user: session?.user }
    if (!userData.user) return false

    const { error } = await supabase
      .from('cloud_chapters')
      .update({ locked_by: null, locked_at: null })
      .eq('id', cloudChapterId)
      .eq('locked_by', userData.user.id) // Only unlock if we hold the lock

    return !error
  },

  async getSharedBooks() {
    const { data: { session } } = await supabase.auth.getSession()
    const userData = { user: session?.user }
    if (!userData.user) return []

    // Step 1: Get book IDs where the user is a collaborator
    const { data: collabs, error: collabError } = await supabase
      .from('project_collaborators')
      .select('book_id')
      .eq('user_id', userData.user.id)

    if (collabError) {
      console.error('Failed to get shared books (collaborators step):', collabError.message || collabError)
      return []
    }

    if (!collabs || collabs.length === 0) return []

    const bookIds = collabs.map((c) => c.book_id)

    // Step 2: Fetch the actual books
    const { data, error } = await supabase
      .from('cloud_books')
      .select('*')
      .in('id', bookIds)

    if (error) {
      console.error('Failed to get shared books (books step):', error.message || error)
      return []
    }
    return data || []
  },

  async syncSettingsToCloud(localSettings: import('../types').Settings) {
    const { data: { session } } = await supabase.auth.getSession()
    const userData = { user: session?.user }
    if (!userData.user) return { success: false }

    const { error } = await supabase
      .from('cloud_settings')
      .upsert({
        user_id: userData.user.id,
        settings: localSettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (error) {
      console.error('Failed to sync settings to cloud:', error)
      return { success: false, error: error.message }
    }
    return { success: true }
  },

  async fetchCloudSettings() {
    const { data: { session } } = await supabase.auth.getSession()
    const userData = { user: session?.user }
    if (!userData.user) return { success: false, settings: null }

    const { data, error } = await supabase
      .from('cloud_settings')
      .select('settings')
      .eq('user_id', userData.user.id)
      .maybeSingle()

    if (error) {
      console.error('Failed to fetch cloud settings:', error)
      return { success: false, error: error.message, settings: null }
    }

    return { success: true, settings: data?.settings || null }
  },

  async backupDatabaseToCloud() {
    const { data: { session } } = await supabase.auth.getSession()
    const userData = { user: session?.user }
    if (!userData.user) return { success: false, error: 'Not logged in' }

    try {
      const buffer = await window.api.database.getBuffer()
      // Create a Blob from the Uint8Array buffer
      const blob = new Blob([buffer], { type: 'application/x-sqlite3' })

      const { error } = await supabase.storage
        .from('user_backups')
        .upload(`${userData.user.id}/write-your-thoughts.db`, blob, {
          upsert: true,
          contentType: 'application/x-sqlite3'
        })

      if (error) throw error
      return { success: true }
    } catch (e: any) {
      console.error('Failed to backup database:', e)
      return { success: false, error: e.message }
    }
  },

  async restoreDatabaseFromCloud() {
    const { data: { session } } = await supabase.auth.getSession()
    const userData = { user: session?.user }
    if (!userData.user) return { success: false, error: 'Not logged in' }

    try {
      const { data, error } = await supabase.storage
        .from('user_backups')
        .download(`${userData.user.id}/write-your-thoughts.db`)

      if (error) throw error

      const arrayBuffer = await data.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      await window.api.database.restoreBuffer(buffer)
      
      return { success: true }
    } catch (e: any) {
      console.error('Failed to restore database:', e)
      return { success: false, error: e.message }
    }
  },

  async processSyncQueue() {
    const { data: { session } } = await supabase.auth.getSession()
    const userData = { user: session?.user }
    if (!userData.user) return { success: false, error: 'Not logged in' }

    try {
      const pendingTasks: any[] = await window.api.database.getPendingSync()
      if (!pendingTasks || pendingTasks.length === 0) return { success: true }

      console.log(`[Sync] Processing ${pendingTasks.length} queued tasks...`)

      for (const task of pendingTasks) {
        const typeToTable: Record<string, string> = {
          'book': 'cloud_books',
          'chapter': 'cloud_chapters',
          'character': 'cloud_characters',
          'location': 'cloud_locations',
          'note': 'cloud_notes',
          'codex': 'cloud_codex',
          'wiki': 'cloud_wiki',
          'organizations': 'cloud_organizations',
          'world_rules': 'cloud_world_rules',
          'workspace_state': 'cloud_workspace_state' // Phase 4
        }
        
        const cloudTable = typeToTable[task.entity_type]
        if (!cloudTable) {
          // Unknown entity type, remove from queue
          await window.api.database.markSyncComplete(task.id)
          continue
        }

        if (task.operation === 'delete') {
          const { error } = await supabase.from(cloudTable).delete().eq('id', task.entity_id)
          if (!error) {
            await window.api.database.markSyncComplete(task.id)
            
            // Clean up associated images from storage to save space
            if (['cloud_books', 'cloud_characters', 'cloud_locations'].includes(cloudTable)) {
              import('./storageService').then(({ deleteImage }) => {
                const typeMap: Record<string, 'books' | 'characters' | 'locations'> = {
                  'cloud_books': 'books',
                  'cloud_characters': 'characters',
                  'cloud_locations': 'locations'
                }
                deleteImage(typeMap[cloudTable], task.entity_id, 'unknown').catch(() => {})
              })
            }
          }
          continue
        }

        // Handle Upsert / Create / Update
        const localRow = await window.api.database.getEntityRow({ entityType: task.entity_type, entityId: task.entity_id })
        
        if (!localRow) {
          // Row was deleted locally before we could sync it, mark complete
          await window.api.database.markSyncComplete(task.id)
          continue
        }

        const cloudRow = { ...localRow }
        // Strip legacy columns that might be lingering in old SQLite databases
        if ('lexical_json' in cloudRow) delete cloudRow.lexical_json
        
        // Map user_id to owner_id for books
        if (cloudTable === 'cloud_books' && cloudRow.user_id) {
          cloudRow.owner_id = cloudRow.user_id
          delete cloudRow.user_id
        }

        // Phase 4: Format workspace_state for Supabase (JSONB requires parsed objects, not strings if inserted via JS client)
        if (cloudTable === 'cloud_workspace_state') {
          if (typeof cloudRow.open_tabs === 'string') cloudRow.open_tabs = JSON.parse(cloudRow.open_tabs)
          if (typeof cloudRow.panel_state === 'string') cloudRow.panel_state = JSON.parse(cloudRow.panel_state)
          delete cloudRow.id // In Supabase, user_id is the PK, no need for the local SQLite uuid
        }

        const { error } = await supabase.from(cloudTable).upsert(cloudRow)
        if (!error) {
          await window.api.database.markSyncComplete(task.id)
        } else {
          console.error(`[Sync] Error upserting to ${cloudTable}:`, JSON.stringify(error, null, 2))
        }
      }
      
      console.log(`[Sync] Queue processing complete.`)
      return { success: true }
    } catch (e: any) {
      console.error('[Sync] Failed to process sync queue:', e)
      return { success: false, error: e.message }
    }
  },

  /**
   * Phase 3 — Pull all user data from Supabase into local SQLite.
   * Strategy:
   *   - No conflict  → silently merge (cloud wins for new-device scenario)
   *   - Conflict detected (both local & cloud modified since last sync) → keep both,
   *     return a list of conflict notices to display as toasts.
   */
  async performInitialPull(): Promise<{ success: boolean; conflicts: string[]; recordsPulled: number }> {
    const { data: { session } } = await supabase.auth.getSession()
    const userData = { user: session?.user }
    if (!userData.user) return { success: false, conflicts: [], recordsPulled: 0 }

    const conflicts: string[] = []
    let totalPulled = 0

    try {
      console.log('[Sync] Starting initial pull from cloud...')

      // ── 1. Pull books first (others depend on book_id) ───────────────────────
      const { data: cloudBooks, error: booksErr } = await supabase
        .from('cloud_books')
        .select('*')
        .eq('owner_id', userData.user.id)

      if (!booksErr && cloudBooks) {
        for (const cloudBook of cloudBooks) {
          // Map cloud field names → local field names
          const localRow = {
            id: cloudBook.id,
            user_id: userData.user.id,
            title: cloudBook.title,
            author_name: cloudBook.author_name ?? '',
            genre: cloudBook.genre ?? '',
            description: cloudBook.description ?? '',
            cover_image: cloudBook.cover_image ?? '',
            status: cloudBook.status ?? 'writing',
            synced: 1,
            cloud_id: cloudBook.cloud_id ?? cloudBook.id,
            created_at: cloudBook.created_at,
            updated_at: cloudBook.updated_at,
          }
          const result = await window.api.database.upsertCloudRow({ entityType: 'book', row: localRow })
          if (result?.conflict) conflicts.push(`📖 Book conflict: "${cloudBook.title}" — both versions preserved`)
          totalPulled++
        }
      }

      // ── 2. Pull child entities ────────────────────────────────────────────────
      const childTables = [
        { cloud: 'cloud_chapters',    local: 'chapter',      labelField: 'title' },
        { cloud: 'cloud_characters',  local: 'character',    labelField: 'name' },
        { cloud: 'cloud_locations',   local: 'location',     labelField: 'name' },
        { cloud: 'cloud_notes',       local: 'note',         labelField: 'title' },
        { cloud: 'cloud_codex',       local: 'codex',        labelField: 'title' },
        { cloud: 'cloud_wiki',        local: 'wiki',         labelField: 'title' },
        { cloud: 'cloud_organizations', local: 'organizations', labelField: 'name' },
        { cloud: 'cloud_world_rules', local: 'world_rules',  labelField: 'title' },
      ]

      for (const table of childTables) {
        const { data, error } = await supabase.from(table.cloud).select('*')
        if (error) { console.error(`[Sync] Pull error for ${table.cloud}:`, error); continue }
        if (!data || data.length === 0) continue

        for (const cloudRow of data) {
          // Strip cloud-only fields that don't exist in local SQLite
          const localRow = { ...cloudRow }
          delete localRow.owner_id   // cloud_books only, already handled

          const result = await window.api.database.upsertCloudRow({ entityType: table.local, row: localRow })
          if (result?.conflict) {
            const label = cloudRow[table.labelField] || cloudRow.id
            conflicts.push(`⚡ Conflict in "${label}" — both versions preserved`)
          }
          totalPulled++
        }
      }

      console.log(`[Sync] Pull complete. ${totalPulled} records, ${conflicts.length} conflicts.`)

      // ── 3. Pull Workspace State (Phase 4) ───────────────────────────────────
      const { data: wsData, error: wsError } = await supabase
        .from('cloud_workspace_state')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle()

      if (!wsError && wsData) {
        await window.api.editor.saveWorkspaceState({
          userId: userData.user.id,
          currentBookId: wsData.current_book_id,
          currentChapterId: wsData.current_chapter_id,
          openTabs: typeof wsData.open_tabs === 'string' ? JSON.parse(wsData.open_tabs) : wsData.open_tabs,
          panelState: typeof wsData.panel_state === 'string' ? JSON.parse(wsData.panel_state) : wsData.panel_state
        })
        console.log('[Sync] Workspace state restored from cloud')
      }

      return { success: true, conflicts, recordsPulled: totalPulled }
    } catch (e: any) {
      console.error('[Sync] Initial pull failed:', e)
      return { success: false, conflicts: [], recordsPulled: 0 }
    }
  },

  // ── Realtime subscriptions ───────────────────────────────────────────────────
  _realtimeChannel: null as ReturnType<typeof supabase.channel> | null,

  /**
   * Subscribe to Supabase Realtime changes.
   * When another device pushes a change to cloud tables, the callback fires
   * so the local DB + React store can be updated instantly.
   */
  subscribeToRealtime(onRemoteChange: (entityType: string, row: any, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void) {
    if (this._realtimeChannel) return // already subscribed

    const tables = [
      { cloud: 'cloud_books',         local: 'book' },
      { cloud: 'cloud_chapters',      local: 'chapter' },
      { cloud: 'cloud_characters',    local: 'character' },
      { cloud: 'cloud_locations',     local: 'location' },
      { cloud: 'cloud_notes',         local: 'note' },
      { cloud: 'cloud_codex',         local: 'codex' },
      { cloud: 'cloud_workspace_state', local: 'workspace_state' }
    ]

    // Use a unique channel name to prevent HMR crashes where the old channel is still subscribed
    let channel = supabase.channel(`wyt-realtime-${Date.now()}`)

    for (const t of tables) {
      channel = channel.on(
        'postgres_changes' as any,
        { event: '*', schema: 'public', table: t.cloud },
        (payload: any) => {
          console.log(`[Realtime] ${payload.eventType} on ${t.cloud}`, payload)
          onRemoteChange(t.local, payload.new ?? payload.old, payload.eventType)
        }
      )
    }

    this._realtimeChannel = channel.subscribe((status) => {
      console.log('[Realtime] Status:', status)
    })
  },

  unsubscribeFromRealtime() {
    if (this._realtimeChannel) {
      supabase.removeChannel(this._realtimeChannel)
      this._realtimeChannel = null
      console.log('[Realtime] Unsubscribed.')
    }
  },

  // Keep old pullFromCloud as alias for backwards compat
  async pullFromCloud() {
    return this.performInitialPull()
  }
}
