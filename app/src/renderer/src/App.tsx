import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { authService } from './services/authService'
import { useUserStore } from './stores/userStore'
import { useWorkspaceStore } from './stores/workspaceStore'
import { useToastStore } from './stores/toastStore'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import WorkspacePage from './pages/workspace/WorkspacePage'
import AppLayout from './layouts/AppLayout'
import SettingsPage from './pages/settings/SettingsPage'
import ToastContainer from './components/ui/ToastContainer'

function App() {
  const { user, isLoading, setUser, setLocalUser, setLoading, setSettings } = useUserStore()
  const theme = useUserStore(state => state.settings?.theme)
  const { refreshFromDb } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()


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

          try {
            const { syncService } = await import('./services/syncService')

            // ── Phase 1: Push any pending local changes up ──────────────
            await syncService.processSyncQueue()

            // ── Phase 3: Pull cloud data down into local SQLite ─────────
            const pullResult = await syncService.performInitialPull()
            if (pullResult.success && pullResult.recordsPulled > 0) {
              // Refresh the React store from the freshly-updated SQLite DB
              await refreshFromDb(session.user.id)
              addToast(`Synced ${pullResult.recordsPulled} records from cloud`, 'success')
            }
            // Show conflict toasts if any
            for (const conflict of pullResult.conflicts) {
              addToast(conflict, 'info')
            }

            // ── Phase 3 & 4: Subscribe to Realtime for live updates ─────────
            syncService.subscribeToRealtime(async (entityType, row, eventType) => {
              if (eventType === 'DELETE') return // deletes are rare; skip for now
              
              if (entityType === 'workspace_state') {
                await window.api.editor.saveWorkspaceState({
                  userId: session.user.id,
                  currentBookId: row.current_book_id,
                  currentChapterId: row.current_chapter_id,
                  openTabs: typeof row.open_tabs === 'string' ? JSON.parse(row.open_tabs) : row.open_tabs,
                  panelState: typeof row.panel_state === 'string' ? JSON.parse(row.panel_state) : row.panel_state
                })
              } else {
                await window.api.database.upsertCloudRow({ entityType, row })
              }
              await refreshFromDb(session.user.id)
            })

            // ── Settings sync ────────────────────────────────────────────
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
            console.error('Failed to sync on boot', e)
          } finally {
            setLoading(false)
          }
        })
      } else {
        setLoading(false)
      }
    })

    // Listen for auth state changes
    const { data: { subscription } } = authService.onAuthStateChange(async (u) => {
      setUser(u)
      if (!u) {
        // Unsubscribe from Realtime on logout
        const { syncService } = await import('./services/syncService')
        syncService.unsubscribeFromRealtime()
        navigate('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Apply theme class to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

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
