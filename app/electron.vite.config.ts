import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    server: {
      fs: { allow: [searchForWorkspaceRoot(process.cwd()), resolve('../assets/maps')] }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    // Allow the WASM binary to be served from node_modules in dev mode
    optimizeDeps: {
      exclude: ['sql.js']
    }
  }
})
