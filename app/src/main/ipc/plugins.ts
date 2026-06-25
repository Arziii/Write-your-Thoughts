import { IpcMain, app } from 'electron'
import { join } from 'path'
import { readdirSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs'

export interface PluginInfo {
  id: string
  name: string
  description: string
  version: string
  code: string
  enabled: boolean
}

let pluginsDir = ''

export function registerPluginHandlers(ipcMain: IpcMain): void {
  pluginsDir = join(app.getPath('userData'), 'plugins')
  if (!existsSync(pluginsDir)) {
    mkdirSync(pluginsDir, { recursive: true })
  }

  ipcMain.handle('plugins:getAll', async () => {
    try {
      const files = readdirSync(pluginsDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'))
      const plugins: PluginInfo[] = []
      
      for (const file of files) {
        const code = readFileSync(join(pluginsDir, file), 'utf-8')
        // Very basic parsing for a header, or we just return the raw code and let renderer execute it.
        // For MVP, we'll just use the filename as ID and Name.
        plugins.push({
          id: file,
          name: file.replace(/\.(js|ts)$/, ''),
          description: 'Local plugin',
          version: '1.0.0',
          code,
          enabled: true // State could be stored in a config json later
        })
      }
      return plugins
    } catch (err) {
      console.error('[Plugins Error]', err)
      return []
    }
  })

  ipcMain.handle('plugins:save', async (event, data: { name: string, code: string }) => {
    try {
      const safeName = data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      const filePath = join(pluginsDir, `${safeName}.js`)
      writeFileSync(filePath, data.code, 'utf-8')
      return { success: true, id: `${safeName}.js` }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('plugins:delete', async (event, id: string) => {
    try {
      const filePath = join(pluginsDir, id)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
