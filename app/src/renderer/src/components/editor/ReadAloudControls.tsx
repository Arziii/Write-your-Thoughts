import type { Editor } from '@tiptap/react'
import { Loader2, Pause, Play, Square, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  createReadingUtterance, getLocalVoices, getReadingStyle, kokoroPassages, prepareKokoroAudio, prepareNarration, resolveLocalVoice,
  useReadAloudPreferences, kokoroError, type ReadingStyle, type KokoroClip,
} from '../../services/readAloud'
import { useToastStore } from '../../stores/toastStore'

const RATES = [0.75, 1, 1.25, 1.5]
const CONTROL_CLASS = 'flex h-7 items-center gap-1.5 rounded px-1.5 text-xs text-surface-400 hover:bg-surface-700 hover:text-surface-200'

interface ReadingProgress {
  style: ReadingStyle
  passages: string[]
  passageIndex: number
}

interface WindowsReading extends ReadingProgress {
  provider: 'windows'
  voice: SpeechSynthesisVoice
  offset: number
  utterance: SpeechSynthesisUtterance | null
}

interface KokoroReading extends ReadingProgress {
  provider: 'kokoro'
  aiNarration: boolean
  voiceId: string
  controller: AbortController
  clip: KokoroClip | null
  nextClip: Promise<KokoroClip> | null
}

type ReadingSession = WindowsReading | KokoroReading

function releaseReading(session: ReadingSession | null) {
  if (session?.provider === 'kokoro') {
    session.controller.abort()
    session.clip?.release()
    void session.nextClip?.then(clip => clip.release(), () => {})
  } else if (session?.utterance) {
    window.speechSynthesis.cancel()
  }
}

function readPassages(text: string): string[] {
  // Keep utterances short for long chapters. Prefer splitting between words.
  return text.split(/\r?\n/)
    .flatMap(paragraph => paragraph.match(/.{1,220}(?=\s|$)|.{1,220}/gu) ?? [])
    .map(passage => passage.trim())
    .filter(Boolean)
}

export default function ReadAloudControls({ editor }: { editor: Editor }) {
  const engine = window.speechSynthesis
  const addToast = useToastStore(state => state.addToast)
  const [status, setStatus] = useState<'idle' | 'preparing' | 'reading' | 'paused'>('idle')
  const sessionRef = useRef<ReadingSession | null>(null)
  const rate = useRef(1)
  const playbackButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // The first voice lookup can start asynchronous discovery in Chromium.
    engine?.getVoices()
    return () => {
      const session = sessionRef.current
      sessionRef.current = null
      releaseReading(session)
    }
  }, [engine])

  const stop = () => {
    const session = sessionRef.current
    sessionRef.current = null
    releaseReading(session)
    setStatus('idle')
  }

  const speakPassage = (session: WindowsReading) => {
    const startOffset = session.offset
    const text = session.passages[session.passageIndex].slice(startOffset)
    const utterance = createReadingUtterance(text, session.voice, session.style, rate.current)
    utterance.onboundary = event => {
      if (sessionRef.current !== session || session.utterance !== utterance) return
      if (event.name === 'word' && event.charIndex < utterance.text.length) {
        session.offset = Math.max(session.offset, startOffset + event.charIndex)
      }
    }
    utterance.onend = () => {
      if (sessionRef.current !== session || session.utterance !== utterance) return
      session.passageIndex += 1
      session.offset = 0
      if (session.passageIndex < session.passages.length) {
        speakPassage(session)
      } else {
        sessionRef.current = null
        setStatus('idle')
      }
    }
    utterance.onerror = () => {
      if (sessionRef.current !== session || session.utterance !== utterance) return
      stop()
      addToast('Read Aloud could not play the Windows voice.', 'error')
    }
    session.utterance = utterance
    engine.speak(utterance)
  }

  const failKokoro = (session: KokoroReading, error: unknown) => {
    if (sessionRef.current !== session) return
    stop()
    addToast(kokoroError(error), 'error')
  }

  const playKokoro = async (session: KokoroReading) => {
    setStatus('preparing')
    try {
      const signal = session.controller.signal
      const prepare = async (index: number) => {
        signal.throwIfAborted()
        let text = session.passages[index]
        if (session.aiNarration) {
          try {
            text = await prepareNarration(text, signal)
          } catch {
            signal.throwIfAborted()
            session.aiNarration = false
            addToast('AI Storytelling is unavailable. Reading as written.', 'info')
          }
        }
        return prepareKokoroAudio(text, session.voiceId, signal, session.style)
      }
      const nextClip = session.nextClip
      session.nextClip = null
      const clip = await (nextClip ?? prepare(session.passageIndex))
      if (sessionRef.current !== session) {
        clip.release()
        return
      }
      session.clip = clip
      clip.audio.playbackRate = rate.current
      clip.audio.onended = () => {
        if (sessionRef.current !== session) return
        clip.release()
        session.clip = null
        session.passageIndex += 1
        if (session.passageIndex < session.passages.length) void playKokoro(session)
        else stop()
      }
      clip.audio.onerror = () => failKokoro(session, new Error('Could not play the audio returned by Kokoro.'))
      await clip.audio.play()
      if (sessionRef.current !== session || session.clip !== clip) return
      setStatus('reading')
      if (session.passageIndex + 1 < session.passages.length) {
        session.nextClip = prepare(session.passageIndex + 1)
        void session.nextClip.catch(() => {})
      }
    } catch (error) {
      failKokoro(session, error)
    }
  }

  const start = () => {
    const { doc, selection } = editor.state
    const from = selection.empty ? 0 : selection.from
    const to = selection.empty ? doc.content.size : selection.to
    const text = doc.textBetween(from, to, '\n', node => node.type.name === 'hardBreak' ? '\n' : '')
    const { provider, voiceURI, kokoroVoiceId, styleId, aiNarration } = useReadAloudPreferences.getState()
    const passages = provider === 'kokoro' ? kokoroPassages(text) : readPassages(text)
    if (!passages.length) {
      addToast(selection.empty ? 'This chapter has no text to read.' : 'Select some text to read.')
      return
    }

    const progress = { style: getReadingStyle(styleId), passages, passageIndex: 0 }
    if (provider === 'kokoro') {
      if (!kokoroVoiceId) {
        addToast('Choose a Kokoro voice in Settings → Read Aloud.', 'info')
        return
      }
      const session: KokoroReading = {
        ...progress, provider, voiceId: kokoroVoiceId, aiNarration, controller: new AbortController(), clip: null, nextClip: null,
      }
      sessionRef.current = session
      void playKokoro(session)
      return
    }

    if (!engine || typeof SpeechSynthesisUtterance === 'undefined') {
      addToast('Read Aloud is unavailable on this device.', 'error')
      return
    }
    const voice = resolveLocalVoice(getLocalVoices(), voiceURI)
    if (!voice) {
      addToast('No local voice is available. Check the installed voices in Windows Speech settings and try again.', 'error')
      return
    }

    const session: WindowsReading = { ...progress, provider: 'windows', voice, offset: 0, utterance: null }
    sessionRef.current = session
    setStatus('reading')
    speakPassage(session)
  }

  const togglePlayback = () => {
    const session = sessionRef.current
    if (!session) {
      start()
    } else if (session.provider === 'kokoro') {
      const audio = session.clip?.audio
      if (!audio || status === 'preparing') return
      if (audio.paused) {
        setStatus('reading')
        void audio.play().catch(error => failKokoro(session, error))
      } else {
        audio.pause()
        setStatus('paused')
      }
    } else if (session.utterance) {
      // Some Windows voices keep speaking after pause(), so cancel and keep the last word offset.
      session.utterance = null
      engine.cancel()
      setStatus('paused')
    } else {
      setStatus('reading')
      speakPassage(session)
    }
  }

  const label = { idle: 'Read Aloud', preparing: 'Preparing audio…', reading: 'Pause', paused: 'Resume' }[status]
  const Icon = { idle: Volume2, preparing: Loader2, reading: Pause, paused: Play }[status]

  return (
    <div role="group" aria-label="Read Aloud controls" className="flex shrink-0 items-center gap-0.5">
      <button
        ref={playbackButton}
        type="button"
        className={`${CONTROL_CLASS} disabled:opacity-60`}
        title={status === 'idle' ? 'Read selected text or the entire chapter' : status === 'preparing' ? label : `${label} reading`}
        disabled={status === 'preparing'}
        onClick={togglePlayback}
      >
        <Icon className={`h-3.5 w-3.5 ${status === 'preparing' ? 'animate-spin' : ''}`} aria-hidden="true" />
        {label}
      </button>
      {status !== 'idle' && (
        <button
          type="button"
          className={CONTROL_CLASS}
          title="Stop reading"
          aria-label="Stop reading"
          onClick={() => {
            playbackButton.current?.focus()
            stop()
          }}
        >
          <Square className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <select
        aria-label="Reading speed"
        title="Reading speed"
        defaultValue={1}
        onChange={event => {
          rate.current = Number(event.currentTarget.value)
          const session = sessionRef.current
          if (session?.provider === 'kokoro' && session.clip) {
            session.clip.audio.playbackRate = rate.current
          }
        }}
        className="h-7 rounded border border-transparent bg-transparent px-1 text-xs text-surface-400 hover:border-surface-700"
      >
        {RATES.map(value => <option key={value} value={value}>{value}×</option>)}
      </select>
    </div>
  )
}
