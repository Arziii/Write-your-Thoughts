import { useEffect, useRef, useState } from 'react'
import { useToastStore } from '../stores/toastStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { scheduleCloudSync, syncNow } from '../services/syncService'
import { refreshPendingSync } from '../stores/cloudSyncStore'

type Status = 'saved' | 'saving' | 'unsaved'
type Write = { persist: () => Promise<void>; status: (status: Status) => void }
interface Job {
  pending?: Write
  active?: Promise<boolean>
  idle?: ReturnType<typeof setTimeout>
  deadline?: ReturnType<typeof setTimeout>
}

const jobs = new Map<string, Job>()

function flush(id: string, drain = false): Promise<boolean> {
  const job = jobs.get(id)
  if (!job) return Promise.resolve(true)
  if (job.active) return job.active.then(ok => drain && ok ? flush(id, true) : ok)
  if (!job.pending) return Promise.resolve(true)

  clearTimeout(job.idle)
  clearTimeout(job.deadline)
  job.deadline = undefined
  const write = job.pending
  job.pending = undefined
  write.status('saving')

  job.active = Promise.resolve().then(write.persist).then(() => {
    scheduleCloudSync()
    void refreshPendingSync()
    if (!job.pending) {
      write.status('saved')
      useWorkspaceStore.getState().clearDraft(id)
      jobs.delete(id)
    }
    return true
  }).catch(() => {
    if (!job.pending) {
      job.pending = write
      write.status('unsaved')
    }
    useToastStore.getState().addToast('Could not save locally. Press Ctrl+S to retry.', 'error')
    return false
  }).finally(() => { job.active = undefined })

  return job.active.then(ok => drain && ok ? flush(id, true) : ok)
}

export async function flushEditorSaves(): Promise<boolean> {
  const results = await Promise.all([...jobs.keys()].map(id => flush(id, true)))
  return results.every(Boolean)
}

export function useEditorSave<T extends Record<string, unknown>>(
  id: string,
  persist: (draft: T) => Promise<void>,
  messages = { synced: 'Saved and synced.', pending: 'Saved locally. Cloud sync is pending.' },
) {
  const [status, setStatus] = useState<Status>(() => jobs.has(id) ? 'unsaved' : 'saved')
  const hasDraft = useWorkspaceStore(state => Boolean(state.drafts[id]))
  const currentPersist = useRef(persist)
  currentPersist.current = persist

  function updateStatus(value: Status) {
    setStatus(value)
    useWorkspaceStore.getState().markTabDirty(id, value !== 'saved')
  }

  function stage(draft: T) {
    const job = jobs.get(id) ?? {}
    jobs.set(id, job)
    useWorkspaceStore.getState().setDraft(id, draft)
    updateStatus('unsaved')
    job.pending = { persist: () => currentPersist.current(draft), status: updateStatus }
    clearTimeout(job.idle)
    job.idle = setTimeout(() => { void flush(id, true) }, 10_000)
    job.deadline ??= setTimeout(() => { void flush(id, true) }, 30_000)
  }

  async function save() {
    if (!await flush(id, true)) return
    const result = await syncNow()
    useToastStore.getState().addToast(
      result.success ? messages.synced : messages.pending,
      result.success ? 'success' : 'info',
    )
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's' || event.shiftKey || event.altKey) return
      event.preventDefault()
      if (!event.repeat) void save()
    }
    window.addEventListener('keydown', keydown)
    return () => {
      window.removeEventListener('keydown', keydown)
      void flush(id, true)
    }
  }, [id, messages.synced, messages.pending])

  return { stage, save, status: hasDraft ? status : 'saved', flushLocal: () => flush(id, true) }
}
