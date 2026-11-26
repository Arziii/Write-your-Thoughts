import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { authService } from './services/authService'
import { useUserStore } from './stores/userStore'
import { useWorkspaceStore } from './stores/workspaceStore'
import { useToastStore } from './stores/toastStore'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import VerifyEmailPage from './pages/auth/VerifyEmailPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import WorkspacePage from './pages/workspace/WorkspacePage'
import AppLayout from './layouts/AppLayout'
import SettingsPage from './pages/settings/SettingsPage'
import ChatStudioPage from './pages/workspace/ChatStudioPage'
import ToastContainer from './components/ui/ToastContainer'
import { flushEditorSaves } from './hooks/useEditorSave'
import { activeAudiobookExports } from './services/audiobookExport'
import { startCloudSyncScheduler, syncNow, syncService } from './services/syncService'
import { isLocalAIProvider } from './services/ai/configuration'
import type { User } from '@supabase/supabase-js'

function App() {
  const { user, isLoading, setUser, setLocalUser, setLoading, setSettings } = useUserStore()
  const theme = useUserStore(state => state.settings?.theme)
  const { refreshFromDb } = useWorkspaceStore()
  const { addToast } = useToastStore()
  const navigate = useNavigate()

  useEffect(() => {
    const stopSync = startCloudSyncScheduler()
    const stopClose = window.api.window.onPrepareClose?.(async () => {
      if (activeAudiobookExports.size) {
        useToastStore.getState().addToast('Audiobook export is running. Wait for it to finish or cancel it first.', 'info')
        return false
      }
      return flushEditorSaves()
    })
    return () => {
      stopSync?.()
      stopClose?.()
    }
  }, [])


  useEffect(() => {
    // Deep Link Listener
    const stopDeepLinks = window.api.system?.onDeepLink(async (url: string) => {
      try {
        const hashParams = new URLSearchParams(url.split('#')[1])
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')
        
        if (accessToken && refreshToken) {
          console.log('[DeepLink] Setting session from deep link...')
          const { error } = await authService.setSession(accessToken, refreshToken)
          if (error) throw error
          addToast('Successfully authenticated!', 'success')
          
          if (type === 'recovery') {
            navigate('/reset-password')
          } else {
            navigate('/')
          }
        } else if (url.includes('auth/reset-password')) {
           navigate('/reset-password' + (url.split('#')[1] ? '#' + url.split('#')[1] : ''))
        }
      } catch (err) {
        console.error('[DeepLink] Error handling deep link:', err)
        addToast('Failed to authenticate from link.', 'error')
      }
    })

    let active = true
    let sessionRevision = 0
    async function openSavedSession() {
      const revision = sessionRevision
      try {
        const cachedUser = await authService.getOfflineUser()
        if (!active || revision !== sessionRevision) return
        if (cachedUser) {
          await openWorkspace(cachedUser, revision)
          return
        }
        if (navigator.onLine) {
          const session = await authService.getSession()
          if (active && session?.user) await openWorkspace(session.user, revision)
        }
      } catch (error) {
        console.error('Failed to open saved workspace:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    async function openWorkspace(nextUser: User, revision: number) {
      const [profile, localSettings] = await Promise.all([
        window.api.auth.getStoredUser(nextUser.id),
        window.api.settings.get(nextUser.id),
      ])
      if (!active || revision !== sessionRevision) return
      setLocalUser(profile ?? null)
      setSettings(localSettings ?? null)
      setUser(nextUser)
    }

    void openSavedSession()

    const { data: { subscription } } = authService.onAuthStateChange((event, nextUser) => {
      if (event === 'SIGNED_OUT') {
        sessionRevision++
        setUser(null)
        setLocalUser(null)
        setSettings(null)
        navigate('/login')
        return
      }
      if (event === 'USER_UPDATED' && nextUser?.id === useUserStore.getState().user?.id) {
        setUser(nextUser)
        return
      }
      if (event !== 'SIGNED_IN' || !nextUser || useUserStore.getState().isFreshLogin ||
          useUserStore.getState().user?.id === nextUser.id) return
      void openWorkspace(nextUser, ++sessionRevision).catch(error => console.error('Could not open workspace:', error))
    })

    // Track selection changes globally for TextAreas and Inputs to support AI Polish on any page
    let lastActiveTextArea: HTMLTextAreaElement | HTMLInputElement | null = null
    
    // We don't import debounce here to keep it simple, just basic throttle
    let selTimeout: any = null
    const handleSelectionChange = () => {
      if (selTimeout) clearTimeout(selTimeout)
      selTimeout = setTimeout(() => {
        const activeEl = document.activeElement
        if (activeEl && (activeEl.tagName === 'TEXTAREA' || (activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'text'))) {
          const el = activeEl as HTMLTextAreaElement
          const text = el.value.substring(el.selectionStart || 0, el.selectionEnd || 0)
          if (text) {
            lastActiveTextArea = el
            useWorkspaceStore.getState().setSelectedText(text)
          }
        }
      }, 100)
    }
    document.addEventListener('selectionchange', handleSelectionChange)

    const handleReplaceSelection = (e: any) => {
      const { text } = e.detail
      if (lastActiveTextArea && document.body.contains(lastActiveTextArea)) {
        lastActiveTextArea.focus()
        document.execCommand('insertText', false, text)
      }
    }
    window.addEventListener('replace-textarea-selection', handleReplaceSelection)

    return () => {
      active = false
      subscription.unsubscribe()
      stopDeepLinks?.()
      clearTimeout(selTimeout)
      document.removeEventListener('selectionchange', handleSelectionChange)
      window.removeEventListener('replace-textarea-selection', handleReplaceSelection)
    }
  }, [])

  useEffect(() => {
    if (!user || window.api.isMock) return
    const userId = user.id
    let active = true
    let connecting = false
    let rerunOnConnect = false

    async function connectCloud() {
      if (!active || !navigator.onLine) return
      if (connecting) {
        rerunOnConnect = true
        return
      }
      connecting = true
      const localSettingsAtStart = useUserStore.getState().settings
      try {
        const session = await authService.getSession()
        if (!active || session?.user.id !== userId) return
        if (!await flushEditorSaves() || !active) return
        await syncNow()
        if (!active || !navigator.onLine) return

        const pull = await syncService.performInitialPull()
        if (!active || !navigator.onLine) return
        if (pull.recordsPulled > 0) await refreshFromDb(userId)
        if (!active) return
        for (const conflict of pull.conflicts) addToast(conflict, 'info')

        syncService.subscribeToRealtime(async (entityType, row, eventType) => {
          if (!active || eventType === 'DELETE') return
          try {
            if (entityType === 'workspace_state') {
              await window.api.editor.saveWorkspaceState({
                userId,
                currentBookId: row.current_book_id,
                currentChapterId: row.current_chapter_id,
                openTabs: typeof row.open_tabs === 'string' ? JSON.parse(row.open_tabs) : row.open_tabs,
                panelState: typeof row.panel_state === 'string' ? JSON.parse(row.panel_state) : row.panel_state,
              })
            } else {
              await window.api.database.upsertCloudRow({ entityType, row })
            }
            if (active) await refreshFromDb(userId)
          } catch (error) {
            console.error('Failed to apply cloud update:', error)
          }
        })

        if (syncService.hasPendingSettings(userId)) {
          await syncService.flushPendingSettings(userId)
          return
        }
        const remote = await syncService.fetchCloudSettings()
        if (!active || !remote.success || !remote.settings || syncService.hasPendingSettings(userId) ||
            useUserStore.getState().settings !== localSettingsAtStart) return
        const localSettings = localSettingsAtStart
        const cloud = remote.settings
        const localProvider = localSettings?.ai_provider
        const keepLocalProvider = localProvider &&
          isLocalAIProvider(localProvider, localSettings?.ai_settings?.[localProvider]?.baseUrl)
        const updated = await window.api.settings.update({
          userId,
          theme: cloud.theme,
          accentColor: cloud.accent_color,
          editorFont: cloud.editor_font,
          fontSize: cloud.font_size,
          lineSpacing: cloud.line_spacing,
          aiProvider: keepLocalProvider ? localProvider : cloud.ai_provider,
          aiApiKey: keepLocalProvider ? undefined : cloud.ai_api_key || localSettings?.ai_api_key,
          aiStylePrompt: cloud.ai_style_prompt || localSettings?.ai_style_prompt,
          preserveFormatting: cloud.preserve_formatting === 1 || cloud.preserve_formatting === true,
          autosaveInterval: cloud.autosave_interval,
        })
        if (active && updated && useUserStore.getState().settings === localSettingsAtStart) setSettings(updated)
      } catch (error) {
        console.error('Cloud sync could not connect:', error)
      } finally {
        connecting = false
        if (rerunOnConnect) {
          rerunOnConnect = false
          void connectCloud()
        }
      }
    }

    void connectCloud()
    window.addEventListener('online', connectCloud)
    return () => {
      active = false
      window.removeEventListener('online', connectCloud)
      syncService.unsubscribeFromRealtime()
    }
  }, [user?.id])

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
        <Route path="/verify-email" element={user ? <Navigate to="/" replace /> : <VerifyEmailPage />} />
        <Route path="/forgot-password" element={user ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected routes */}
        <Route element={user ? <AppLayout /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<WorkspacePage />} />
          <Route path="/book/:bookId" element={<WorkspacePage />} />
          <Route path="/book/:bookId/chapter/:chapterId" element={<WorkspacePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/ai-chat" element={<ChatStudioPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </>
  )
}

export default App
