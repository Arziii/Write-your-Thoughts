import { create } from 'zustand'

interface CloudSyncState {
  pending: number | null
  syncing: boolean
  failed: boolean
  countUnavailable: boolean
  lastSync: number | null
  lastBackup: number | null
}

const initial: CloudSyncState = { pending: null, syncing: false, failed: false, countUnavailable: false, lastSync: null, lastBackup: null }
export const useCloudSyncStore = create<CloudSyncState>(() => initial)
let lastRefresh = 0

function readTimestamp(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export function loadCloudSyncHistory(userId?: string) {
  lastRefresh++
  useCloudSyncStore.setState({
    ...initial,
    lastSync: userId ? readTimestamp('wyt-db-last-sync-' + userId) : null,
    lastBackup: userId ? readTimestamp('wyt-db-last-backup-' + userId) : null,
  })
}

export async function refreshPendingSync() {
  if (window.api.isMock) return
  const request = ++lastRefresh
  try {
    const pending = await window.api.database.getPendingSyncCount()
    if (request === lastRefresh) {
      useCloudSyncStore.setState(pending === 0 ? { pending, failed: false, countUnavailable: false } : { pending, countUnavailable: false })
    }
  } catch {
    if (request === lastRefresh) useCloudSyncStore.setState({ pending: null, countUnavailable: true })
  }
}

export function recordCloudSync(userId: string, time: number) {
  try { localStorage.setItem('wyt-db-last-sync-' + userId, String(time)) } catch { /* Keep in-memory status available. */ }
  useCloudSyncStore.setState({ lastSync: time })
}
