import { useEffect, useId, useRef, useState } from 'react'
import { Check, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { syncNow, syncService } from '../../services/syncService'
import { loadCloudSyncHistory, refreshPendingSync, useCloudSyncStore } from '../../stores/cloudSyncStore'
import { useUserStore } from '../../stores/userStore'
import { cn } from '../../utils'

const formatTime = (time: number | null) => time
  ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(time)
  : 'None recorded'

export default function CloudSyncStatus({ online }: { online: boolean }) {
  const userId = useUserStore(state => state.user?.id)
  const { pending, syncing, failed, countUnavailable, lastSync, lastBackup } = useCloudSyncStore()
  const [open, setOpen] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const lastBackupLookup = useRef(0)
  const detailsId = useId()
  const available = Boolean(userId && !window.api.isMock)

  useEffect(() => {
    loadCloudSyncHistory(userId)
    lastBackupLookup.current = 0
    if (!available) return
    const refresh = () => { void refreshPendingSync() }
    refresh()
    const timer = window.setInterval(refresh, 10_000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [userId, available])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      if (container.current?.contains(document.activeElement)) trigger.current?.focus()
    }
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  if (!available) return null

  const working = syncing || retrying
  const label = working ? 'Syncing…'
    : failed && online ? 'Retry sync'
    : pending !== null && pending > 0 ? 'Sync pending'
    : countUnavailable ? 'Sync unavailable'
    : pending === null ? 'Checking sync…'
    : lastSync ? 'Synced' : 'Up to date'
  const Icon = working ? RefreshCw : !online || failed ? CloudOff : pending === 0 ? Check : Cloud

  function toggleDetails() {
    setOpen(!open)
    if (open) return
    void refreshPendingSync()
    if (!online || Date.now() - lastBackupLookup.current < 60_000) return
    lastBackupLookup.current = Date.now()
    void syncService.getCloudBackupInfo().then(info => {
      const time = info?.updatedAt?.getTime()
      if (time && useUserStore.getState().user?.id === userId) {
        useCloudSyncStore.setState(state => ({ lastBackup: Math.max(state.lastBackup ?? 0, time) }))
      }
    }).catch(() => { /* Keep the last recorded backup time. */ })
  }

  async function retry() {
    setRetrying(true)
    try {
      await syncNow()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div ref={container} className="titlebar-no-drag relative mr-1 shrink-0">
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={open ? detailsId : undefined}
        onClick={toggleDetails} title="Cloud sync details"
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-surface-800',
          failed || pending ? 'text-warning-400' : 'text-surface-400',
        )}>
        <Icon className={cn('h-3.5 w-3.5', working && 'animate-spin')} aria-hidden="true" />
        <span role="status">{label}</span>
      </button>

      {open && (
        <section id={detailsId} aria-label="Cloud sync details"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-surface-700 bg-surface-950 p-3.5 text-sm text-surface-100 shadow-xl">
          <h2 className="font-semibold">Cloud sync</h2>
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-surface-400">Queued changes</dt><dd>{pending ?? 'Unavailable'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-surface-400">Last sync on this device</dt><dd className="text-right">{formatTime(lastSync)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-surface-400">Last backup</dt><dd className="text-right">{formatTime(lastBackup)}</dd></div>
          </dl>
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-surface-800 pt-3">
            <p className="text-xs text-surface-400">
              {!online ? 'Sync resumes when you reconnect.' : failed ? 'Changes stay queued until sync succeeds.' : ''}
            </p>
            <button type="button" disabled={!online || working} onClick={() => void retry()}
              className="shrink-0 rounded-md border border-surface-700 px-2.5 py-1.5 text-xs font-medium hover:bg-surface-800 disabled:opacity-50">
              {working ? 'Syncing…' : failed ? 'Retry sync' : 'Sync now'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
