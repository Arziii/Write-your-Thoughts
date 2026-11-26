import { randomInt } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { app, nativeImage, type IpcMain } from 'electron'
import { isLoopbackAIUrl } from '../../shared/localAI'
import { MAX_IMAGE_PROMPT_LENGTH, SDXL_BASE_CHECKPOINT, type StudioImageRequest } from '../../shared/chatStudio'
import { startStudioImageServer, stopStudioImageServer } from './studioImageServer'

const dimensions = { square: [768, 768], landscape: [896, 640], portrait: [640, 896] }
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_UNREACHABLE_MS = 90_000

type ImageJob = {
  controller: AbortController
  submission?: Promise<string>
}

function containsJob(entries: unknown, id: string): boolean {
  return Array.isArray(entries) && entries.some(entry => Array.isArray(entry) && entry[1] === id)
}

function comfyClient(server: string) {
  if (!isLoopbackAIUrl(server)) throw new Error('Enter a ComfyUI address on this device, such as http://127.0.0.1:8188.')
  const base = server.replace(/\/+$/, '')
  return async (route: string, body?: object, signal?: AbortSignal, allowMissing = false) => {
    signal?.throwIfAborted()
    let response: Response
    try {
      const timer = AbortSignal.timeout(15_000)
      response = await fetch(base + route, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: signal ? AbortSignal.any([timer, signal]) : timer,
      })
    } catch (error) {
      signal?.throwIfAborted()
      if (!(error instanceof Error) || !('cause' in error) ||
          (error.cause as NodeJS.ErrnoException | undefined)?.code !== 'ECONNREFUSED' ||
          route !== '/models/checkpoints' || !(await startStudioImageServer(base))) {
        throw new Error('Could not reach ComfyUI. Start it and check the server address.')
      }
      signal?.throwIfAborted()
      const timer = AbortSignal.timeout(8000)
      response = await fetch(base + route, {
        redirect: 'error', signal: signal ? AbortSignal.any([timer, signal]) : timer,
      })
    }
    if (allowMissing && (response.status === 404 || response.status === 405)) return response
    if (!response.ok) {
      const details = await response.json().catch(() => undefined)
      throw new Error(details?.error?.message || 'ComfyUI returned HTTP ' + response.status + '.')
    }
    return response
  }
}

async function listCheckpoints(request: ReturnType<typeof comfyClient>, signal?: AbortSignal): Promise<string[]> {
  const response = await request('/models/checkpoints', undefined, signal)
  const names: unknown = await response.json()
  if (!Array.isArray(names)) throw new Error('The server did not return ComfyUI checkpoints.')
  return names.filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
}

function workflow({ checkpoint, prompt, shape }: StudioImageRequest) {
  const [width, height] = dimensions[shape]
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
        seed: randomInt(2 ** 32), steps: 22, cfg: 6, sampler_name: 'euler', scheduler: 'normal', denoise: 1,
      },
    },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'WriteYourThoughts' } },
  }
}

async function generateImage(options: StudioImageRequest, job: ImageJob) {
  const { signal } = job.controller
  const prompt = options.prompt?.trim()
  if (!prompt || prompt.length > MAX_IMAGE_PROMPT_LENGTH) throw new Error('Enter an image prompt of up to 2,000 characters.')
  if (!Object.prototype.hasOwnProperty.call(dimensions, options.shape)) throw new Error('Choose an image shape.')
  const request = comfyClient(options.server)
  const checkpoints = await listCheckpoints(request, signal)
  const checkpoint = options.checkpoint || checkpoints.find(name => name === SDXL_BASE_CHECKPOINT)
  if (!checkpoint || !checkpoints.includes(checkpoint)) {
    throw new Error('Choose an installed SDXL or Stable Diffusion 1.5 checkpoint in Image setup.')
  }

  signal.throwIfAborted()
  // Let the submission return its ID even if Stop is pressed during the request.
  job.submission = (async () => {
    const { prompt_id: id } = await (await request('/prompt', { prompt: workflow({ ...options, prompt, checkpoint }) })).json()
    if (typeof id !== 'string' || !id) throw new Error('ComfyUI did not queue the image.')
    return id
  })()
  const id = await job.submission
  let lastConfirmed = Date.now()
  while (true) {
    await delay(1200, undefined, { signal })
    let history
    try {
      history = await (await request('/history/' + encodeURIComponent(id), undefined, signal)).json()
      if (!history?.[id]) {
        const queue = await (await request('/queue', undefined, signal)).json()
        if (containsJob(queue?.queue_running, id) || containsJob(queue?.queue_pending, id)) {
          lastConfirmed = Date.now()
          continue
        }
      }
    } catch {
      // Retry brief outages without submitting the same image again.
    }
    signal.throwIfAborted()
    const job = history?.[id]
    if (!job) {
      if (Date.now() - lastConfirmed >= MAX_UNREACHABLE_MS) {
        throw new Error('ComfyUI no longer reports this image job. Check its output before trying again.')
      }
      continue
    }
    if (job.status?.status_str === 'error') throw new Error('ComfyUI could not render this image. Check the checkpoint and available GPU memory.')
    const output = job.outputs?.['7']?.images?.[0]
    if (!output || typeof output.filename !== 'string' || typeof output.subfolder !== 'string' || output.type !== 'output') {
      throw new Error('ComfyUI finished without returning an image.')
    }

    const query = new URLSearchParams({ filename: output.filename, subfolder: output.subfolder, type: 'output' })
    const response = await request('/view?' + query, undefined, signal)
    const reader = response.body?.getReader()
    if (!reader) throw new Error('ComfyUI returned an empty image.')
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        bytes += value.length
        if (bytes > MAX_IMAGE_BYTES) throw new Error('The returned image is too large.')
        chunks.push(value)
      }
    } finally {
      await reader.cancel().catch(() => {})
    }
    const image = nativeImage.createFromBuffer(Buffer.concat(chunks))
    const { width, height } = image.getSize()
    if (image.isEmpty() || width > 2048 || height > 2048) throw new Error('ComfyUI returned an invalid image.')
    return 'data:image/png;base64,' + image.toPNG().toString('base64')
  }
}

export function registerStudioImageHandlers(ipcMain: IpcMain) {
  const active = new Map<string, { server: string; job: ImageJob }>()
  app.once('will-quit', stopStudioImageServer)
  ipcMain.handle('studioImages:models', (_event, server: string) => listCheckpoints(comfyClient(server)))
  ipcMain.handle('studioImages:generate', async (event, options: StudioImageRequest, requestId: string) => {
    const key = event.sender.id + ':' + requestId
    if (active.has(key)) throw new Error('This image request is already running.')
    const job: ImageJob = { controller: new AbortController() }
    active.set(key, { server: options.server, job })
    try {
      return await generateImage(options, job)
    } finally {
      active.delete(key)
    }
  })
  ipcMain.handle('studioImages:cancel', async (event, requestId: string) => {
    const entry = active.get(event.sender.id + ':' + requestId)
    if (!entry) return
    entry.job.controller.abort()
    if (!entry.job.submission) return
    const id = await entry.job.submission
    const request = comfyClient(entry.server)
    const result = await request('/api/jobs/' + encodeURIComponent(id) + '/cancel', {}, undefined, true)
    if (!result.ok) {
      await request('/queue', { delete: [id] })
      const queue = await (await request('/queue')).json()
      if (containsJob(queue?.queue_running, id)) throw new Error('This ComfyUI version cannot cancel an individual running job.')
    }
  })
}
