import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './database/init'
import { registerIpcHandlers } from './ipc/handlers'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const iconPath = join(__dirname, '../../build/icon.ico')
  console.log('[Main] Icon path:', iconPath)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: true, // Show immediately — don't wait for ready-to-show in dev
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0e14',
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow loading local WASM in dev
    },
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Open DevTools in dev so we can see renderer errors
  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Log renderer errors to main process console
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Renderer] Failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) {
      console.error('[Renderer Console]', message)
    }
  })

  // Window control events
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized'))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:unmaximized'))
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.writeyourthoughts.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize SQLite — if it fails, log but continue so UI still loads
  try {
    await initDatabase()
    console.log('[Main] Database initialized successfully')
  } catch (err) {
    console.error('[Main] Database initialization failed:', err)
  }

  // Register IPC handlers
  registerIpcHandlers(ipcMain)

  // Window control handlers
  ipcMain.on('window:minimize', () => mainWindow?.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })
  ipcMain.on('window:close', () => mainWindow?.close())

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
