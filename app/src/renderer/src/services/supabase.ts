import { createClient } from '@supabase/supabase-js'

// These will be configured through settings/env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Fallback to a valid URL format so the app doesn't crash on boot if .env is missing
const safeUrl = supabaseUrl.startsWith('http') ? supabaseUrl : 'https://setup-pending.supabase.co'
const safeKey = supabaseAnonKey || 'setup-pending-key'

export const supabase = createClient(safeUrl, safeKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Desktop app - no URL-based auth
  },
})

export type { User } from '@supabase/supabase-js'
