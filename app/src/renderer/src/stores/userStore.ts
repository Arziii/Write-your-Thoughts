import { create } from 'zustand'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import type { Settings } from '../types'

interface UserStore {
  user: SupabaseUser | null
  localUser: import('../types').User | null
  settings: Settings | null
  isLoading: boolean
  setUser: (user: SupabaseUser | null) => void
  setLocalUser: (localUser: import('../types').User | null) => void
  setSettings: (settings: Settings | null) => void
  setLoading: (loading: boolean) => void
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  localUser: null,
  settings: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLocalUser: (localUser) => set({ localUser }),
  setSettings: (settings) => set({ settings }),
  setLoading: (isLoading) => set({ isLoading }),
}))
