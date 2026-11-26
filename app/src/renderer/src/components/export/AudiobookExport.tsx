import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { activeAudiobookExports } from '../../services/audiobookExport'
import { KOKORO_VOICES } from '../../../../shared/kokoro'
import { getManuscriptParagraphs } from '../../services/manuscriptQuestion'
import { getKokoroApi, getReadingStyle, kokoroPassages, prepareNarration, READING_STYLES, synthesizeKokoro, useReadAloudPreferences, type ReadingStyle } from '../../services/readAloud'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import type { Chapter } from '../../types'

const SELECT = 'block w-full rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-surface-100'

export default function AudiobookExport({ chapters, onClose, onBusyChange }: { chapters: Chapter[]; onClose: () => void; onBusyChange: (busy: boolean) => void }) {
  const preferences = useReadAloudPreferences.getState()
  const [chapterId, setChapterId] = useState('')
  const [voiceId, setVoiceId] = useState(preferences.kokoroVoiceId)
  const [storytelling, setStorytelling] = useState(preferences.aiNarration)
  const [styleId, setStyleId] = useState(preferences.styleId)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(0)
  const [canceling, setCanceling] = useState(false)
  const job = useRef<AbortController | null>(null)
  useEffect(() => () => job.current?.abort(), [])

  const run = async () => {
    if (job.current) return
    const controller = new AbortController()
    job.current = controller
    activeAudiobookExports.add(controller)
    const { signal } = controller
    let completed = 0
    let originalPassages = 0
    let directory = ''
    const style = getReadingStyle(styleId)
    setBusy(true)
    onBusyChange(true)
    setDone(0)
    setTotal(0)
    setCanceling(false)
    setProgress('Checking Kokoro…')
    try {
      if (typeof window.api?.export?.audiobookFolder !== 'function' || typeof window.api.export.audiobookChapter !== 'function') {
        throw new Error('Restart Write Your Thoughts to load local audiobook export.')
      }
      if (!await getKokoroApi().available()) throw new Error('Kokoro voice files are unavailable in this build.')
      const { drafts } = useWorkspaceStore.getState()
      const selected = chapters.flatMap((chapter, index) => {
        if (chapterId && chapter.id !== chapterId) return []
        const draft = drafts[chapter.id]?.content
        const html = typeof draft === 'string' ? draft : chapter.content || ''
        if (!getManuscriptParagraphs(html, false).length) return []
        const paragraphs = getManuscriptParagraphs(html)
        const passages = kokoroPassages(paragraphs.join('\n\n'))
        return passages.length ? [{ chapter, index, passages }] : []
      })
      if (!selected.length) throw new Error('There is no chapter text to export.')
      signal.throwIfAborted()
      const destination = await window.api.export.audiobookFolder()
      if (!destination) { setProgress(''); return }
      directory = destination.directory
      setTotal(selected.reduce((count, chapter) => count + chapter.passages.length + 1, 0))
      for (const { chapter, index, passages } of selected) {
        const clips: ArrayBuffer[] = []
        for (const [i, passage] of passages.entries()) {
          signal.throwIfAborted()
          setProgress(`Chapter ${completed + 1} of ${selected.length} · Passage ${i + 1} of ${passages.length}`)
          let text = passage
          if (storytelling) {
            try {
              text = await prepareNarration(passage, signal)
            } catch {
              signal.throwIfAborted()
              originalPassages += 1
            }
          }
          clips.push(await synthesizeKokoro(text, voiceId, signal, style.rate, style.id === 'storytelling'))
          setDone(count => count + 1)
        }
        signal.throwIfAborted()
        setProgress(`Saving chapter ${completed + 1} of ${selected.length}…`)
        await window.api.export.audiobookChapter(destination.token, `${String(index + 1).padStart(3, '0')} - ${chapter.title}`, clips)
        completed += 1
        setDone(count => count + 1)
      }
      const status = `Saved ${completed} WAV ${completed === 1 ? 'file' : 'files'} to ${directory}`
      setProgress(originalPassages ? `${status}. AI Storytelling was unavailable for ${originalPassages} ${originalPassages === 1 ? 'passage' : 'passages'}, so Kokoro read the original text.` : status)
    } catch (error) {
      const message = signal.aborted ? 'Export canceled.' : error instanceof Error ? error.message : 'Audiobook export failed.'
      setProgress(`${message}${completed ? ` ${completed} completed ${completed === 1 ? 'file is' : 'files are'} in ${directory}.` : ''}`)
    } finally {
      activeAudiobookExports.delete(controller)
      job.current = null
      setBusy(false)
      onBusyChange(false)
    }
  }

  if (busy) return (
    <div className="space-y-5 py-5 text-center" aria-busy="true">
      <Loader2 aria-hidden="true" className="mx-auto h-9 w-9 animate-spin text-accent-500" />
      <h3 className="text-lg font-semibold text-surface-100">{canceling ? 'Canceling export…' : 'Exporting audiobook…'}</h3>
      <p role="status" className="text-sm text-surface-300">{canceling ? 'Finishing the current operation.' : progress}</p>
      <progress aria-label="Audiobook export progress" value={total ? done : undefined} max={total || 1} className="h-2 w-full accent-accent-500" />
      <p className="text-sm text-surface-400">Each WAV appears when its chapter finishes. Canceling keeps the files already saved.</p>
      <button type="button" disabled={canceling} className="rounded-lg bg-surface-800 px-4 py-2 disabled:opacity-50" onClick={() => {
        setCanceling(true)
        job.current?.abort()
      }}>Cancel export</button>
    </div>
  )

  return (
    <div className="space-y-4 overflow-auto">
      <p className="text-sm text-surface-300">Creates one WAV file per chapter on this device. AI Storytelling uses your local AI server. Chapters without body text are skipped.</p>
      <label className="block text-sm">Chapters<select className={SELECT} value={chapterId} disabled={busy} onChange={event => setChapterId(event.target.value)}>
        <option value="">Whole book</option>
        {chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}
      </select></label>
      <label className="block text-sm">Kokoro voice<select className={SELECT} value={voiceId} disabled={busy} onChange={event => setVoiceId(event.target.value)}>
        {KOKORO_VOICES.map(voice => <option key={voice.id} value={voice.id}>{voice.name} ({voice.language})</option>)}
      </select></label>
      <label className="block text-sm">Reading style<select className={SELECT} value={styleId} onChange={event => setStyleId(event.target.value as ReadingStyle['id'])}>
        {READING_STYLES.map(style => <option key={style.id} value={style.id}>{style.name}</option>)}
      </select></label>
      <label className="block text-sm">Narration<select className={SELECT} value={storytelling ? 'storytelling' : 'original'} disabled={busy} onChange={event => setStorytelling(event.target.value === 'storytelling')}>
        <option value="original">Read as Written</option><option value="storytelling">AI Storytelling (Local)</option>
      </select></label>
      {progress && <p role="status" className="break-words text-sm text-surface-300">{progress}</p>}
      <div className="flex gap-3">
        <button type="button" className="rounded-lg bg-surface-800 px-4 py-2" onClick={onClose}>Back</button>
        <button type="button" disabled={busy || !chapters.length} className="rounded-lg bg-accent-600 px-4 py-2 text-white disabled:opacity-50" onClick={run}>Export WAV</button>
      </div>
    </div>
  )
}
