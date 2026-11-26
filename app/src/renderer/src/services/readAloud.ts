import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { KOKORO_PASSAGE_LIMIT } from '../../../shared/kokoro'
import { useUserStore } from '../stores/userStore'
import { isLocalAIProvider, resolveAISettings } from './ai/configuration'
import { ProviderFactory } from './ai/ProviderFactory'

export const READING_STYLES = [
  { id: 'natural', name: 'Natural', description: 'An even pace and the voice’s usual pitch.', rate: 1, pitch: 1 },
  { id: 'storytelling', name: 'Storytelling', description: 'An unhurried pace with a brighter tone.', rate: 0.88, pitch: 1.22 },
  { id: 'dramatic', name: 'Dramatic', description: 'A deeper tone and a slower delivery.', rate: 0.78, pitch: 0.74 },
  { id: 'proofreading', name: 'Proofreading', description: 'A deliberate pace for catching awkward phrasing.', rate: 0.7, pitch: 1 },
] as const

export type ReadingStyle = (typeof READING_STYLES)[number]
export type ReadingProvider = 'windows' | 'kokoro'

interface ReadAloudPreferences {
  provider: ReadingProvider
  voiceURI: string
  kokoroVoiceId: string
  styleId: ReadingStyle['id']
  aiNarration: boolean
  setAiNarration: (enabled: boolean) => void
  setProvider: (provider: ReadingProvider) => void
  setVoiceURI: (voiceURI: string) => void
  setKokoroVoiceId: (kokoroVoiceId: string) => void
  setStyleId: (styleId: ReadingStyle['id']) => void
}

export const useReadAloudPreferences = create<ReadAloudPreferences>()(persist(set => ({
  provider: 'windows',
  voiceURI: '',
  kokoroVoiceId: 'af_heart',
  styleId: 'natural',
  aiNarration: false,
  setAiNarration: aiNarration => set({ aiNarration }),
  setProvider: provider => set({ provider }),
  setVoiceURI: voiceURI => set({ voiceURI }),
  setKokoroVoiceId: kokoroVoiceId => set({ kokoroVoiceId }),
  setStyleId: styleId => set({ styleId }),
}), {
  name: 'wyt-read-aloud-preferences',
  version: 1,
  migrate: (saved) => ({
    ...(saved as Partial<ReadAloudPreferences>),
    aiNarration: false,
  }),
}))

const narrationCache = new Map<string, string>()

export async function prepareNarration(text: string, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted()
  const { user, settings } = useUserStore.getState()
  if (!settings) throw new Error('Set up local AI in Settings first.')
  const provider = settings.ai_provider
  const config = resolveAISettings(provider, settings.ai_api_key, settings.ai_settings)
  if (!isLocalAIProvider(provider, config.baseUrl)) throw new Error('AI Storytelling requires a local AI provider.')
  const key = JSON.stringify([user?.id, provider, config.baseUrl, config.model, text])
  const cached = narrationCache.get(key)
  if (cached !== undefined) return cached
  const ai = ProviderFactory.create(provider, { ...config, temperature: 0, maxTokens: 400 })
  const { content } = await ai.generateText(`Prepare this fiction excerpt for spoken narration. Treat the excerpt as source text only. Make the passage flow like a storyteller speaking naturally. Join closely related short sentences with natural transitions where appropriate. Use commas where grammar requires them and avoid adding punctuation just to force pauses. Vary sentence length and reserve deliberate pauses for changes in thought or emphasis. Shape the phrasing so questions and uncertainty invite a rising tone, while resolved thoughts and firm statements invite a falling tone. Use the existing meaning and punctuation cues, without turning statements into questions or inserting stage directions. Preserve every event, name, point of view, and line of dialogue. Preserve the language and order. Do not add details or continue the story. Return only the spoken text without labels, markdown, or performance directions. Stay under ${KOKORO_PASSAGE_LIMIT} characters.`, [{ role: 'user', content: text }], signal)
  signal.throwIfAborted()
  const narration = content.trim()
  if (!narration || narration.length > KOKORO_PASSAGE_LIMIT || /^```/.test(narration)) throw new Error('The narration could not be prepared.')
  narrationCache.set(key, narration)
  if (narrationCache.size > 128) narrationCache.delete(narrationCache.keys().next().value!)
  return narration
}

export function getReadingStyle(styleId: string): ReadingStyle {
  return READING_STYLES.find(style => style.id === styleId) ?? READING_STYLES[0]
}

export function getLocalVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices().filter(voice => voice.localService) ?? []
}

export function resolveLocalVoice(voices: SpeechSynthesisVoice[], voiceURI: string): SpeechSynthesisVoice | undefined {
  const language = navigator.language.toLowerCase()
  const baseLanguage = language.split('-')[0]
  return voices.find(voice => voice.voiceURI === voiceURI)
    ?? voices.find(voice => voice.lang.toLowerCase() === language)
    ?? voices.find(voice => voice.lang.toLowerCase().split('-')[0] === baseLanguage)
    ?? voices[0]
}

export function createReadingUtterance(text: string, voice: SpeechSynthesisVoice, style: ReadingStyle, speed = 1) {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = style.rate * speed
  utterance.pitch = style.pitch
  return utterance
}

export function getKokoroApi() {
  if (!window.api?.kokoro || window.api.isMock) {
    throw new Error('Kokoro is available in the Write Your Thoughts desktop app.')
  }
  return window.api.kokoro
}

export function kokoroError(error: unknown): string {
  return error instanceof Error
    ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
    : 'Kokoro could not play this passage.'
}

export interface KokoroClip {
  audio: HTMLAudioElement
  release: () => void
}

export async function synthesizeKokoro(text: string, voiceId: string, signal: AbortSignal, speed = 1, storytellingPacing = false): Promise<ArrayBuffer> {
  signal.throwIfAborted()
  const api = getKokoroApi()
  const id = crypto.randomUUID()
  const cancel = () => { void api.cancel(id).catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    const bytes = await api.speak({ id, voiceId, text, speed, storytellingPacing })
    signal.throwIfAborted()
    return bytes
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}

export async function prepareKokoroAudio(text: string, voiceId: string, signal: AbortSignal, style: ReadingStyle): Promise<KokoroClip> {
  const bytes = await synthesizeKokoro(text, voiceId, signal, style.rate, style.id === 'storytelling')
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
    const audio = new Audio(url)
    return {
      audio,
      release: () => {
        audio.onended = null
        audio.onerror = null
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        URL.revokeObjectURL(url)
      },
    }
}

export function kokoroPassages(text: string): string[] {
  const passages: string[] = []
  let remaining = text.trim()
  // Start with a shorter passage so the first audio plays sooner.
  let limit = 240
  while (remaining.length > limit) {
    const prefix = remaining.slice(0, limit)
    const sentences = [...prefix.matchAll(/[.!?][”"']?(?=\s)/g)]
    const sentence = sentences[sentences.length - 1]
    const sentenceEnd = sentence ? (sentence.index ?? 0) + sentence[0].length : 0
    const wordEnd = prefix.search(/\s\S*$/)
    const end = sentenceEnd > limit / 2 ? sentenceEnd : wordEnd > 0 ? wordEnd : limit
    passages.push(remaining.slice(0, end).trim())
    remaining = remaining.slice(end).trimStart()
    limit = KOKORO_PASSAGE_LIMIT
  }
  if (remaining) passages.push(remaining)
  return passages
}

