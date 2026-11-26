import type { IpcMain } from 'electron'
import { isLoopbackAIUrl, type LocalAIRequest, type LocalAIResponse } from '../../shared/localAI'

export function registerLocalAIHandlers(ipcMain: IpcMain): void {
  const requests = new Map<string, AbortController>()
  ipcMain.handle('localAI:cancel', (event, requestId: string) => {
    requests.get(event.sender.id + ':' + requestId)?.abort()
  })
  ipcMain.handle('localAI:request', async (event, request: LocalAIRequest): Promise<LocalAIResponse> => {
    if (!isLoopbackAIUrl(request.baseUrl)) throw new Error('Local AI must use a loopback address.')

    const base = new URL(request.baseUrl)
    const path = base.pathname.replace(/\/+$/, '')
    base.pathname = path + (request.body === undefined ? '/models' : '/chat/completions')

    const timeout = Number.isFinite(request.timeout) ? Math.max(1000, Math.min(request.timeout, 600_000)) : 120_000
    const key = request.requestId ? event.sender.id + ':' + request.requestId : undefined
    const controller = key ? new AbortController() : undefined
    if (key && controller) {
      if (requests.has(key)) throw new Error('This AI request is already running.')
      requests.set(key, controller)
    }
    const timer = AbortSignal.timeout(timeout)
    const signal = controller ? AbortSignal.any([timer, controller.signal]) : timer
    try {
      const response = await fetch(base, {
        method: request.body === undefined ? 'GET' : 'POST',
        headers: request.headers,
        body: request.body,
        redirect: 'error',
        signal,
      })
      return { status: response.status, body: await response.text() }
    } finally {
      if (key) requests.delete(key)
    }
  })
}
