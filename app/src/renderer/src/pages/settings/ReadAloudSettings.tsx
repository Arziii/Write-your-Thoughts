import { Square, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { KOKORO_VOICES } from '../../../../shared/kokoro'
import {
  createReadingUtterance, getKokoroApi, getLocalVoices, getReadingStyle, kokoroError, prepareKokoroAudio,
  READING_STYLES, resolveLocalVoice, useReadAloudPreferences, type ReadingProvider, type ReadingStyle,
} from '../../services/readAloud'
import { useToastStore } from '../../stores/toastStore'

const SELECT_CLASS = 'w-full rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-surface-100 focus-visible:outline focus-visible:outline-accent-500'
const BUTTON_CLASS = 'inline-flex items-center gap-2 rounded-lg border border-surface-700 px-3 py-2 text-sm font-medium text-surface-200 hover:bg-surface-800 disabled:opacity-50'
const PREVIEW_TEXT = 'The library was quiet. Then, from behind the oldest shelf, she heard footsteps.'
const MANDARIN_PREVIEW = '图书馆里很安静。突然，她听见最旧的书架后面传来了脚步声。'
const KOKORO_LANGUAGES = { 'en-US': 'American English', 'en-GB': 'British English', 'zh-CN': 'Mandarin' }
type VoicePreview = { release: () => void }

export default function ReadAloudSettings() {
  const { provider, voiceURI, kokoroVoiceId, styleId, aiNarration, setProvider, setVoiceURI, setKokoroVoiceId, setStyleId, setAiNarration } = useReadAloudPreferences()
  const addToast = useToastStore(state => state.addToast)
  const [voices, setVoices] = useState(getLocalVoices)
  const [kokoroAvailable, setKokoroAvailable] = useState<boolean | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const previewRef = useRef<VoicePreview | null>(null)
  const selectedVoice = resolveLocalVoice(voices, voiceURI)
  const selectedKokoro = KOKORO_VOICES.find(voice => voice.id === kokoroVoiceId)
  const usingKokoro = provider === 'kokoro'
  const voiceMissing = !!voiceURI && !!voices.length && selectedVoice?.voiceURI !== voiceURI
  const style = getReadingStyle(styleId)

  useEffect(() => {
    const engine = window.speechSynthesis
    if (!engine) return
    const updateVoices = () => setVoices(getLocalVoices())
    engine.addEventListener('voiceschanged', updateVoices)
    updateVoices()
    return () => engine.removeEventListener('voiceschanged', updateVoices)
  }, [])

  useEffect(() => () => {
    const preview = previewRef.current
    previewRef.current = null
    preview?.release()
  }, [])

  useEffect(() => {
    let current = true
    Promise.resolve().then(() => getKokoroApi().available()).then(available => {
      if (current) setKokoroAvailable(available)
    }).catch(() => {
      if (current) setKokoroAvailable(false)
    })
    return () => { current = false }
  }, [])

  const stopPreview = () => {
    const preview = previewRef.current
    previewRef.current = null
    preview?.release()
    setIsPreviewing(false)
  }

  const togglePreview = async () => {
    if (previewRef.current) {
      stopPreview()
      return
    }

    const finishPreview = (preview: VoicePreview, error?: unknown) => {
      if (previewRef.current !== preview) return
      stopPreview()
      if (error) addToast(kokoroError(error), 'error')
    }

    if (usingKokoro) {
      if (!kokoroAvailable || !selectedKokoro) return
      const controller = new AbortController()
      const preview = { release: () => controller.abort() }
      previewRef.current = preview
      setIsPreviewing(true)
      try {
        const sample = selectedKokoro.language === 'zh-CN' ? MANDARIN_PREVIEW : PREVIEW_TEXT
        const clip = await prepareKokoroAudio(sample, selectedKokoro.id, controller.signal, style)
        if (previewRef.current !== preview) {
          clip.release()
          return
        }
        preview.release = clip.release
        clip.audio.onended = () => finishPreview(preview)
        clip.audio.onerror = () => finishPreview(preview, new Error('Could not play the Kokoro preview.'))
        await clip.audio.play()
      } catch (error) {
        finishPreview(preview, error)
      }
      return
    }

    if (!selectedVoice) return
    const utterance = createReadingUtterance(PREVIEW_TEXT, selectedVoice, style)
    const preview = { release: () => window.speechSynthesis.cancel() }
    const onFinished = () => {
      if (previewRef.current !== preview) return false
      previewRef.current = null
      setIsPreviewing(false)
      return true
    }
    utterance.onend = onFinished
    utterance.onerror = () => {
      if (onFinished()) addToast('The selected voice could not play the preview.', 'error')
    }
    previewRef.current = preview
    setIsPreviewing(true)
    window.speechSynthesis.speak(utterance)
  }

  const PreviewIcon = isPreviewing ? Square : Volume2

  return (
    <section aria-labelledby="read-aloud-heading" className="space-y-4">
      <h2 id="read-aloud-heading" className="flex items-center gap-2 border-b border-surface-800 pb-2 text-lg font-medium text-surface-100">
        <Volume2 className="h-4 w-4 text-accent-400" aria-hidden="true" />
        Read Aloud
      </h2>
      <div className="glass-card space-y-4 rounded-xl p-5">
        <div>
          <label htmlFor="read-aloud-provider" className="mb-1.5 block text-sm font-medium text-surface-300">Voice engine</label>
          <select
            id="read-aloud-provider"
            className={SELECT_CLASS}
            value={provider}
            onChange={event => {
              stopPreview()
              setProvider(event.target.value as ReadingProvider)
            }}
          >
            <option value="windows">Windows Voices</option>
            <option value="kokoro" disabled={!kokoroAvailable}>Kokoro (Built-in)</option>
          </select>
          {kokoroAvailable === false && <p className="mt-1.5 text-xs text-surface-500">Kokoro voice files are unavailable in this build.</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {usingKokoro ? (
            <div className="min-w-0">
              <label htmlFor="read-aloud-kokoro-voice" className="mb-1.5 block text-sm font-medium text-surface-300">Voice</label>
              <select
                id="read-aloud-kokoro-voice"
                className={SELECT_CLASS}
                value={kokoroVoiceId}
                disabled={!kokoroAvailable}
                onChange={event => {
                  stopPreview()
                  setKokoroVoiceId(event.target.value)
                }}
              >
                {Object.entries(KOKORO_LANGUAGES).map(([language, label]) => (
                  <optgroup key={language} label={label}>
                    {KOKORO_VOICES.filter(voice => voice.language === language).map(voice => (
                      <option key={voice.id} value={voice.id}>{voice.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : (
            <div className="min-w-0">
              <label htmlFor="read-aloud-voice" className="mb-1.5 block text-sm font-medium text-surface-300">Voice</label>
              <select
                id="read-aloud-voice"
                className={SELECT_CLASS}
                value={voiceURI}
                onChange={event => {
                  stopPreview()
                  setVoiceURI(event.target.value)
                }}
                disabled={!voices.length}
              >
                <option value="">Automatic (Windows)</option>
                {voiceURI && !voices.some(voice => voice.voiceURI === voiceURI) && (
                  <option value={voiceURI} disabled>Saved voice unavailable</option>
                )}
                {voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>)}
              </select>
              <p className="mt-1.5 text-xs text-surface-500">
                {voiceMissing ? `Using ${selectedVoice?.name} on this device.` : 'Uses installed Windows voices offline.'}
              </p>
            </div>
          )}
          <div className="min-w-0">
            <label htmlFor="read-aloud-style" className="mb-1.5 block text-sm font-medium text-surface-300">Reading style</label>
            <select
              id="read-aloud-style"
              className={SELECT_CLASS}
              value={style.id}
              onChange={event => {
                stopPreview()
                setStyleId(event.target.value as ReadingStyle['id'])
              }}
            >
              {READING_STYLES.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-surface-500">{usingKokoro ? 'Kokoro uses this preset’s reading pace.' : style.description}</p>
          </div>
        </div>
        {usingKokoro && (
          <div>
            <label htmlFor="read-aloud-narration" className="mb-1.5 block text-sm font-medium text-surface-300">Chapter narration</label>
            <select id="read-aloud-narration" className={SELECT_CLASS} value={aiNarration ? 'storytelling' : 'original'} onChange={event => setAiNarration(event.target.value === 'storytelling')}>
              <option value="original">Match Voice Preview</option>
              <option value="storytelling">AI Storytelling (Local)</option>
            </select>
            <p className="mt-1.5 text-xs text-surface-500">Match Voice Preview reads the original text with the selected voice and reading style. AI Storytelling also adapts the wording.</p>
          </div>
        )}
        {!usingKokoro && !voices.length && <p className="text-sm text-surface-400">If no voices appear, check the installed voices in Windows Speech settings.</p>}
        <button type="button" disabled={usingKokoro ? !kokoroAvailable || !selectedKokoro : !selectedVoice} onClick={togglePreview} className={BUTTON_CLASS}>
          <PreviewIcon className="h-4 w-4" aria-hidden="true" />
          {isPreviewing ? 'Stop preview' : 'Preview voice'}
        </button>
      </div>
    </section>
  )
}
