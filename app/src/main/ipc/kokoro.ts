import { app, type IpcMain } from 'electron'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { KOKORO_PASSAGE_LIMIT, KOKORO_VOICES, type KokoroSpeechRequest } from '../../shared/kokoro'

const require = createRequire(import.meta.url)

interface AudioSamples {
  samples: Float32Array
  sampleRate: number
}

interface KokoroEngine {
  generateAsync: (request: { text: string; sid: number; speed: number; enableExternalBuffer: boolean; generationConfig?: { sid: number; speed: number; silenceScale: number } }) => Promise<AudioSamples>
}

function encodeWave({ samples, sampleRate }: AudioSamples, pauseSeconds = 0): ArrayBuffer {
  if (samples.length === 0) throw new Error('Kokoro found no text it could read in this passage.')
  const headerSize = 44
  const audioSize = (samples.length + Math.round(sampleRate * pauseSeconds)) * 2
  const bytes = new ArrayBuffer(headerSize + audioSize)
  const wav = new DataView(bytes)
  wav.setUint32(0, 0x52494646) // RIFF
  wav.setUint32(4, 36 + audioSize, true)
  wav.setUint32(8, 0x57415645) // WAVE
  wav.setUint32(12, 0x666d7420) // fmt
  wav.setUint32(16, 16, true)
  wav.setUint16(20, 1, true) // PCM
  wav.setUint16(22, 1, true) // Mono
  wav.setUint32(24, sampleRate, true)
  wav.setUint32(28, sampleRate * 2, true)
  wav.setUint16(32, 2, true)
  wav.setUint16(34, 16, true)
  wav.setUint32(36, 0x64617461) // data
  wav.setUint32(40, audioSize, true)
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    wav.setInt16(headerSize + index * 2, sample * 0x7fff, true)
  }
  return bytes
}

export function registerKokoroHandlers(ipcMain: IpcMain): void {
  const modelDir = app.isPackaged
    ? join(process.resourcesPath, 'voices', 'kokoro')
    : join(app.getAppPath(), 'build', 'voices', 'kokoro')
  const modelFile = (name: string) => join(modelDir, name)
  const files = ['model.onnx', 'voices.bin', 'tokens.txt', 'espeak-ng-data', 'lexicon-us-en.txt', 'lexicon-zh.txt']
  const modelReady = () => files.every(file => existsSync(modelFile(file)))

  const initEngine = async (): Promise<KokoroEngine> => {
    if (!modelReady()) throw new Error('The Kokoro voice files are missing. Use Windows Voices or reinstall the Windows build.')
    try {
      const { OfflineTts } = require('sherpa-onnx-node')
      return await OfflineTts.createAsync({
        model: {
          kokoro: {
            model: modelFile('model.onnx'),
            voices: modelFile('voices.bin'),
            tokens: modelFile('tokens.txt'),
            dataDir: modelFile('espeak-ng-data'),
            lexicon: `${modelFile('lexicon-us-en.txt')},${modelFile('lexicon-zh.txt')}`,
          },
          provider: 'cpu',
          numThreads: 2,
        },
        maxNumSentences: 1,
      })
    } catch (error) {
      console.error('Could not start Kokoro', error)
      throw new Error('The Kokoro reader could not start. Try restarting the app.')
    }
  }

  let engine: KokoroEngine | undefined
  let queue: Promise<void> = Promise.resolve()
  const requests = new Map<string, AbortController>()

  ipcMain.handle('kokoro:available', () => modelReady())
  ipcMain.handle('kokoro:cancel', (event, id: string) => requests.get(`${event.sender.id}:${id}`)?.abort())
  ipcMain.handle('kokoro:speak', async (event, { id, voiceId, text, speed = 1, storytellingPacing = false }: KokoroSpeechRequest): Promise<ArrayBuffer> => {
    const voice = KOKORO_VOICES.find(item => item.id === voiceId)
    if (!voice || typeof text !== 'string' || !text.trim() || text.length > KOKORO_PASSAGE_LIMIT) {
      throw new Error('Select a Kokoro voice and a passage to read.')
    }
    if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) throw new Error('Invalid Kokoro reading speed.')
    const key = `${event.sender.id}:${id}`
    if (requests.has(key)) throw new Error('This Kokoro request is already running.')
    const controller = new AbortController()
    requests.set(key, controller)
    const cancel = () => controller.abort()
    event.sender.once('destroyed', cancel)

    const job = queue.then(async () => {
      controller.signal.throwIfAborted()
      engine ??= await initEngine()
      controller.signal.throwIfAborted()
      const audio = await engine.generateAsync({
        text, sid: voice.speaker, speed, enableExternalBuffer: false,
        generationConfig: storytellingPacing ? { sid: voice.speaker, speed, silenceScale: 0.45 } : undefined,
      })
      controller.signal.throwIfAborted()
      return encodeWave(audio, storytellingPacing && /[.!?…][”"’']?$/.test(text.trim()) ? 0.06 : 0)
    })
    queue = job.then(() => {}, () => {})
    try {
      return await job
    } finally {
      requests.delete(key)
      event.sender.removeListener('destroyed', cancel)
    }
  })
}
