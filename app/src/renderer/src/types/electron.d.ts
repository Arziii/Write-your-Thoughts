// ── Electron API type (from preload) ────────────────────────────────
import type { ElectronAPI } from '../../preload/index'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
