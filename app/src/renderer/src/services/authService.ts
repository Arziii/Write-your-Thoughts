import { supabase } from './supabase'
import type { User } from '../types'

import { syncService } from './syncService'

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    let restoredFromCloud = false

    if (data.user) {
      // Store user in local SQLite
      await window.api.auth.storeUser({
        id: data.user.id,
        email: data.user.email!,
        displayName: data.user.user_metadata?.display_name,
        avatarUrl: data.user.user_metadata?.avatar_url,
      })

      // ── Smart cloud restore ─────────────────────────────────────────────
      // Check when the cloud backup was last uploaded
      const cloudInfo = await syncService.getCloudBackupInfo()

      if (cloudInfo?.updatedAt) {
        // Get the most recently modified book in local SQLite
        const localBooks = (await window.api.books.getAll(data.user.id)) as any[]
        const isEmpty = !localBooks || localBooks.length === 0

        let localNewestDate: Date | null = null
        if (!isEmpty) {
          const maxUpdatedAt = localBooks.reduce(
            (max: string, b: any) => (b.updated_at > max ? b.updated_at : max),
            localBooks[0].updated_at as string
          )
          localNewestDate = new Date(maxUpdatedAt)
        }

        // Restore if: local DB is empty  OR  cloud snapshot is newer than local data
        const cloudIsNewer = !localNewestDate || cloudInfo.updatedAt > localNewestDate
        if (cloudIsNewer) {
          console.log(
            '[Sync] Cloud backup is newer than local data — restoring automatically.',
            { cloudUpdatedAt: cloudInfo.updatedAt, localNewest: localNewestDate }
          )
          try {
            const restoreResult = await syncService.restoreDatabaseFromCloud()
            if (restoreResult.success) {
              restoredFromCloud = true
            } else {
              console.warn('[Sync] Auto-restore returned failure:', restoreResult.error)
            }
          } catch (e) {
            // Not fatal — user keeps their local data
            console.warn('[Sync] Auto-restore threw, keeping local data:', e)
          }
        } else {
          console.log('[Sync] Local data is up to date — no restore needed.')
        }
      } else {
        // No cloud backup exists yet (brand new account or first-time backup pending)
        console.log('[Sync] No cloud backup found — skipping restore.')
      }
      // ── End smart cloud restore ─────────────────────────────────────────

      if (!restoredFromCloud) {
        // DB was NOT replaced — apply any cloud settings on top of local data
        const result = await syncService.fetchCloudSettings()
        if (result.success && result.settings) {
          const s = result.settings
          const localSettings: any = await window.api.settings.get(data.user.id)
          const mergedAiApiKey = s.ai_api_key || localSettings?.ai_api_key
          const mergedAiStylePrompt = s.ai_style_prompt || localSettings?.ai_style_prompt

          const updated: any = await window.api.settings.update({
            userId: data.user.id,
            theme: s.theme,
            accentColor: s.accent_color,
            editorFont: s.editor_font,
            fontSize: s.font_size,
            lineSpacing: s.line_spacing,
            aiProvider: s.ai_provider,
            aiApiKey: mergedAiApiKey,
            aiStylePrompt: mergedAiStylePrompt,
            preserveFormatting: s.preserve_formatting === 1 || s.preserve_formatting === true,
            autosaveInterval: s.autosave_interval
          })

          if (!s.ai_api_key && mergedAiApiKey) {
            syncService.syncSettingsToCloud(updated as any).catch(e => console.error('Cloud sync failed', e))
          }
        }
      }
    }

    return { ...data, restoredFromCloud }
  },

  async signUp(email: string, password: string, displayName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: 'wyt://auth/callback',
      },
    })
    if (error) throw error

    if (data.user) {
      await window.api.auth.storeUser({
        id: data.user.id,
        email: data.user.email!,
        displayName: displayName,
      })
    }

    return data
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  async getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  onAuthStateChange(callback: (event: string, user: import('@supabase/supabase-js').User | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session?.user ?? null)
    })
  },

  async setSession(access_token: string, refresh_token: string) {
    return await supabase.auth.setSession({ access_token, refresh_token })
  },

  async resetPasswordForEmail(email: string) {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'wyt://auth/reset-password',
    })
  },

  async updatePassword(password: string) {
    return await supabase.auth.updateUser({ password })
  },

  async updateProfile(displayName: string) {
    const { data, error } = await supabase.auth.updateUser({
      data: { display_name: displayName }
    })
    if (error) throw error

    if (data.user) {
      await window.api.auth.storeUser({
        id: data.user.id,
        email: data.user.email!,
        displayName: displayName,
      })
    }
    return data
  },

  async updateDashboardCover(coverUrl: string | null) {
    const { data, error } = await supabase.auth.updateUser({
      data: { dashboard_cover: coverUrl }
    })
    if (error) throw error
    return data
  },

  async updateAvatar(avatarUrl: string | null) {
    const { data, error } = await supabase.auth.updateUser({
      data: { avatar_url: avatarUrl }
    })
    if (error) throw error
    return data
  }
}

export type { User }
