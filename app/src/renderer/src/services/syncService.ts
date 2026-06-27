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
        await syncService.backupDatabaseToCloud()
        console.log('[Sync] Debounced backup completed')
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
    const { data: userData } = await supabase.auth.getUser()
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
      
      const { data: userData, error: userError } = await supabase.auth.getUser()
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
    const { data: userData } = await supabase.auth.getUser()
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
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return false

    const { error } = await supabase
      .from('cloud_chapters')
      .update({ locked_by: null, locked_at: null })
      .eq('id', cloudChapterId)
      .eq('locked_by', userData.user.id) // Only unlock if we hold the lock

    return !error
  },

  async getSharedBooks() {
    const { data: userData } = await supabase.auth.getUser()
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
    const { data: userData } = await supabase.auth.getUser()
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
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return { success: false, settings: null }

    const { data, error } = await supabase
      .from('cloud_settings')
      .select('settings')
      .eq('user_id', userData.user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Failed to fetch cloud settings:', error)
      return { success: false, error: error.message, settings: null }
    }

    return { success: true, settings: data?.settings || null }
  },

  async backupDatabaseToCloud() {
    const { data: userData } = await supabase.auth.getUser()
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
    const { data: userData } = await supabase.auth.getUser()
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
  }
}
