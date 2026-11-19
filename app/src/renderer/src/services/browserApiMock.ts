/**
 * Browser API Mock Bridge
 * 
 * Provides graceful fallback stubs when the application is previewed
 * inside a standard web browser (where Electron's native IPC preload is absent).
 * This prevents white/black screens caused by `window.api is undefined`.
 */

export function setupBrowserApiMock() {
  if (typeof window === 'undefined') return
  if (window.api) return

  console.warn(
    '[Write Your Thoughts] No Electron environment detected. Running with browser mock bridge.'
  )

  const createMockService = (serviceName: string) => {
    return new Proxy({}, {
      get(_target, prop: string) {
        if (prop === 'then' || prop === 'catch') return undefined
        return (...args: any[]) => {
          console.debug(`[BrowserMock] ${serviceName}.${prop} called with:`, args)
          if (prop.startsWith('get') || prop.startsWith('fetch') || prop.startsWith('list')) {
            if (prop.endsWith('All') || prop.endsWith('List') || prop === 'getByBook' || prop === 'getByChapter') {
              return Promise.resolve([])
            }
            return Promise.resolve(null)
          }
          if (prop.startsWith('on') || prop.startsWith('watch')) {
            return () => {}
          }
          return Promise.resolve({ success: true })
        }
      }
    })
  }

  const mockApi: any = new Proxy({ isMock: true }, {
    get(target, prop: string) {
      if (prop in target) return (target as any)[prop]

      if (prop === 'system') {
        return {
          onDeepLink: (_cb: any) => () => {}
        }
      }

      if (prop === 'window') {
        return {
          minimize: () => console.log('[BrowserMock] Window minimize'),
          maximize: () => console.log('[BrowserMock] Window maximize'),
          close: () => console.log('[BrowserMock] Window close'),
          onMaximized: (_cb: any) => () => {},
          onUnmaximized: (_cb: any) => () => {}
        }
      }

      if (prop === 'auth') {
        return {
          storeUser: async (user: any) => {
            if (user?.id) {
              localStorage.setItem(`wyt_user_${user.id}`, JSON.stringify(user))
            }
            return user
          },
          getStoredUser: async (userId: string) => {
            const raw = localStorage.getItem(`wyt_user_${userId}`)
            return raw ? JSON.parse(raw) : null
          }
        }
      }

      if (prop === 'settings') {
        return {
          get: async (userId: string) => {
            const raw = localStorage.getItem(`wyt_settings_${userId}`)
            return raw ? JSON.parse(raw) : null
          },
          update: async (settings: any) => {
            if (settings?.userId) {
              localStorage.setItem(`wyt_settings_${settings.userId}`, JSON.stringify(settings))
            }
            return settings
          }
        }
      }

      if (prop === 'database') {
        return {
          getBuffer: async () => {
            throw new Error('Open the desktop app to back up your workspace.')
          },
          restoreBuffer: async () => {
            throw new Error('Open the desktop app to restore your workspace.')
          },
          getPendingSync: async () => [],
          markSyncComplete: async () => ({ success: true }),
          getEntityRow: async () => null,
          upsertEntityRow: async () => ({ success: true }),
          upsertCloudRow: async () => ({ success: true })
        }
      }

      return createMockService(prop)
    }
  })

  ;(window as any).api = mockApi
}
