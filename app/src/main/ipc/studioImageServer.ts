import { spawn, type ChildProcess } from 'node:child_process'
import { closeSync, existsSync, openSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { app } from 'electron'
import { DEFAULT_IMAGE_SERVER } from '../../shared/chatStudio'

let processOwnedByApp: ChildProcess | undefined
let starting: Promise<boolean> | undefined

export function stopStudioImageServer() {
  processOwnedByApp?.kill()
  processOwnedByApp = undefined
}

export async function startStudioImageServer(server: string): Promise<boolean> {
  if (process.platform !== 'win32' || server.replace(/\/+$/, '') !== DEFAULT_IMAGE_SERVER) return false
  const localAppData = process.env.LOCALAPPDATA ?? join(app.getPath('home'), 'AppData', 'Local')
  const install = join(localAppData, 'Programs', 'WYT-ComfyUI', 'ComfyUI_windows_portable')
  const python = join(install, 'python_embeded', 'python.exe')
  const main = join(install, 'ComfyUI', 'main.py')
  if (!existsSync(python) || !existsSync(main)) return false

  if (!starting) {
    starting = launch(python, main, install).finally(() => { starting = undefined })
  }
  return starting
}

async function launch(python: string, main: string, install: string): Promise<boolean> {
  if (!processOwnedByApp) {
    const log = openSync(join(install, 'wyt-comfyui.log'), 'a')
    try {
      const child = spawn(python, [
        '-s', main, '--windows-standalone-build', '--listen', '127.0.0.1', '--port', '8188',
        '--lowvram', '--offline', '--disable-auto-launch', '--disable-assets', '--disable-all-custom-nodes',
      ], { cwd: install, windowsHide: true, stdio: ['ignore', log, log] })
      processOwnedByApp = child
      const release = () => { if (processOwnedByApp === child) processOwnedByApp = undefined }
      child.once('error', release)
      child.once('exit', release)
    } finally {
      closeSync(log)
    }
  }

  const deadline = Date.now() + 90_000
  while (processOwnedByApp && Date.now() < deadline) {
    try {
      const response = await fetch(DEFAULT_IMAGE_SERVER + '/system_stats', {
        redirect: 'error', signal: AbortSignal.timeout(1200),
      })
      if (response.ok) return true
    } catch {
      // The service is still loading.
    }
    await delay(650)
  }
  throw new Error('ComfyUI could not start. Check wyt-comfyui.log in the local ComfyUI installation.')
}
