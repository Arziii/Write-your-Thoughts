import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { authService } from './services/authService'
import { useUserStore } from './stores/userStore'
import { useWorkspaceStore } from './stores/workspaceStore'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import WorkspacePage from './pages/workspace/WorkspacePage'
import AppLayout from './layouts/AppLayout'
import SettingsPage from './pages/settings/SettingsPage'
import ToastContainer from './components/ui/ToastContainer'
import { scheduleSyncBackup } from './services/syncService'

function App() {
  const { user, isLoading, setUser, setLocalUser, setLoading, setSettings } = useUserStore()
  const navigate = useNavigate()

  // Track previous books/chapters counts to detect real data writes
  const prevBooksLen = useRef<number>(0)
  const prevChaptersLen = useRef<number>(0)

  useEffect(() => {
    // Check existing session on app launch
    authService.getSession().then((session) => {
      if (session?.user) {
        setUser(session.user)
        // Load local user details (like avatar) from SQLite
        window.api.auth.getStoredUser(session.user.id).then((lUser) => {
          if (lUser) setLocalUser(lUser as never)
        })
        // Load user settings from SQLite
        window.api.settings.get(session.user.id).then(async (localSettings) => {
          if (localSettings) setSettings(localSettings as never)

          // Background sync with cloud
          try {
            const { syncService } = await import('./services/syncService')
            const result = await syncService.fetchCloudSettings()
            if (result.success && result.settings) {
              const updated = await window.api.settings.update({
                userId: session.user.id,
                theme: result.settings.theme,
                accentColor: result.settings.accent_color,
                editorFont: result.settings.editor_font,
                fontSize: result.settings.font_size,
                lineSpacing: result.settings.line_spacing,
                aiProvider: result.settings.ai_provider,
                aiApiKey: result.settings.ai_api_key,
                aiStylePrompt: result.settings.ai_style_prompt,
                preserveFormatting: result.settings.preserve_formatting === 1,
                autosaveInterval: result.settings.autosave_interval
              })
              setSettings(updated as never)
            }
          } catch (e) {
            console.error('Failed to sync cloud settings on boot', e)
          } finally {
            setLoading(false)
          }
        })
      } else {
        setLoading(false)
      }
    })

    // Listen for auth state changes
    const { data: { subscription } } = authService.onAuthStateChange((u) => {
      setUser(u)
      if (!u) navigate('/login')
    })

    // ── Backup interval: 90 seconds (safety net) ──────────────────────────
    const backupInterval = setInterval(() => {
      authService.getSession().then((session) => {
        if (session?.user) {
          import('./services/syncService').then(({ syncService }) => {
            syncService.backupDatabaseToCloud().catch(e => console.error('Interval backup failed:', e))
          })
        }
      })
    }, 90 * 1000)

    // ── Upload immediately when the user switches away from the app ────────
    // This ensures Device B gets the latest data even between interval ticks.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        authService.getSession().then((session) => {
          if (session?.user) {
            import('./services/syncService').then(({ syncService }) => {
              syncService.backupDatabaseToCloud().catch(e =>
                console.error('Visibility-change backup failed:', e)
              )
            })
          }
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // ── Subscribe to workspace store: trigger debounced backup on writes ──
    // We watch books and chapters lengths; if they grow/shrink, data changed.
    const unsubscribeStore = useWorkspaceStore.subscribe((state) => {
      const booksChanged = state.books.length !== prevBooksLen.current
      const chaptersChanged = state.chapters.length !== prevChaptersLen.current
      prevBooksLen.current = state.books.length
      prevChaptersLen.current = state.chapters.length

      if (booksChanged || chaptersChanged) {
        authService.getSession().then((session) => {
          if (session?.user) scheduleSyncBackup(15_000)
        })
      }
    })

    return () => {
      subscription.unsubscribe()
      clearInterval(backupInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      unsubscribeStore()
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-surface-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-accent-500 border-t-transparent animate-spin" />
          <p className="text-surface-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />

        {/* Protected routes */}
        <Route element={user ? <AppLayout /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<WorkspacePage />} />
          <Route path="/book/:bookId" element={<WorkspacePage />} />
          <Route path="/book/:bookId/chapter/:chapterId" element={<WorkspacePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  )
}

export default App
