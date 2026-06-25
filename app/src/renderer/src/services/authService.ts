import { supabase } from './supabase'
import type { User } from '../types'

import { syncService } from './syncService'

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    if (data.user) {
      // Store user in local SQLite
      await window.api.auth.storeUser({
        id: data.user.id,
        email: data.user.email!,
        displayName: data.user.user_metadata?.display_name,
      })

      // Fetch cloud settings and update local DB
      const result = await syncService.fetchCloudSettings()
      if (result.success && result.settings) {
        // We need to update local settings
        await window.api.settings.update({
          userId: data.user.id,
          ...result.settings
        })
      }
    }

    return data
  },

  async signUp(email: string, password: string, displayName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
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

  onAuthStateChange(callback: (user: import('@supabase/supabase-js').User | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null)
    })
  },
}

export type { User }
