import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, Download, ImagePlus, Loader2, MessageSquare, Plus, Settings2, Square } from 'lucide-react'
import MessageActions from '../../components/ai/MessageActions'
import { DEFAULT_IMAGE_SERVER, MAX_IMAGE_PROMPT_LENGTH, SDXL_BASE_CHECKPOINT, type ImageShape } from '../../../../shared/chatStudio'
import { getAIConfigurationError } from '../../services/ai/configuration'
import {
  getStudioMessages, getStudioThreads, replyInStudio, saveStudioMessages,
  type StudioMessage, type StudioThread,
} from '../../services/chatStudio'
import { useUserStore } from '../../stores/userStore'
import { cn } from '../../utils'

const textLimit = 6400
const field = 'rounded-lg border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-surface-100 focus:outline-none focus:ring-2 focus:ring-accent-500'
const subtleButton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-surface-700 px-3 py-2 text-sm font-medium hover:bg-surface-800 disabled:opacity-50'
const messageButton = 'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-surface-400 hover:bg-surface-850 hover:text-surface-100 focus-visible:outline-accent-700 disabled:opacity-50'
const imageExamples = ['A misty library at dawn, warm lantern light, illustrated book cover', 'An ink-and-watercolor map of a fictional coastal town']
const chatExamples = ['Give me three prompts for a mystery opening', 'Help me plan a 20-minute writing session']

function readImageSetup(key: string) {
  try {
    const data = JSON.parse(localStorage.getItem(key) || '{}')
    return {
      server: typeof data?.server === 'string' ? data.server : DEFAULT_IMAGE_SERVER,
      checkpoint: typeof data?.checkpoint === 'string' ? data.checkpoint : '',
    }
  } catch {
    return { server: DEFAULT_IMAGE_SERVER, checkpoint: '' }
  }
}

function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method .*?: Error: /, '')
}

export default function ChatStudioPage() {
  const userId = useUserStore(state => state.user?.id)
  return userId ? <ChatStudio key={userId} userId={userId} /> : null
}

function ChatStudio({ userId }: { userId: string }) {
  const settings = useUserStore(state => state.settings)
  const imageSetupKey = 'wyt-studio-image-' + userId
  const [threads, setThreads] = useState<StudioThread[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<StudioMessage[]>([])
  const [mode, setMode] = useState<'text' | 'image'>('text')
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [notice, setNotice] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState('')
  const [imageSetup, setImageSetup] = useState(() => readImageSetup(imageSetupKey))
  const [setupOpen, setSetupOpen] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [checking, setChecking] = useState(false)
  const [setupStatus, setSetupStatus] = useState('')
  const [shape, setShape] = useState<ImageShape>('square')
  const checkpointOptions = models.length ? models : imageSetup.checkpoint ? [imageSetup.checkpoint] : []
  const endOfChat = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const generation = useRef<{ controller: AbortController; imageId?: string; restore: () => void } | null>(null)

  useEffect(() => {
    let current = true
    getStudioThreads(userId).then(history => {
      if (current) setThreads(history)
    }).catch(() => {
      if (current) setError('Could not load saved chats.')
    }).finally(() => {
      if (current) setLoadingHistory(false)
    })
    return () => { current = false }
  }, [userId])

  useEffect(() => {
    endOfChat.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy])

  function newChat() {
    setActiveId(null)
    setMessages([])
    setInput('')
    setError('')
    setEditingId(null)
    setNotice('')
    composer.current?.focus()
  }

  async function openThread(thread: StudioThread) {
    setLoadingHistory(true)
    setError('')
    setEditingId(null)
    setNotice('')
    try {
      const history = await getStudioMessages(thread.id)
      setActiveId(thread.id)
      setMessages(history)
      setInput('')
    } catch {
      setError('Could not open this chat.')
    } finally {
      setLoadingHistory(false)
    }
  }

  function saveImageSetup(next: typeof imageSetup) {
    setImageSetup(next)
    try {
      localStorage.setItem(imageSetupKey, JSON.stringify(next))
    } catch {
      setSetupStatus('Image settings can be used this session. They could not be saved.')
    }
  }

  async function checkImageServer() {
    setChecking(true)
    setSetupStatus('')
    setModels([])
    try {
      if (window.api.isMock) throw new Error('Open the desktop app to use local image generation.')
      const server = imageSetup.server.trim()
      const available: string[] = await window.api.studioImages.models(server)
      setModels(available)
      const checkpoint = available.includes(imageSetup.checkpoint) ? imageSetup.checkpoint
        : available.find(name => name === SDXL_BASE_CHECKPOINT) ?? ''
      setSetupStatus(checkpoint ? 'Connected. Image generation is ready.'
        : available.length ? 'Connected. Choose a compatible checkpoint below.'
          : 'Connected. Install an SDXL or Stable Diffusion 1.5 checkpoint in ComfyUI.')
      saveImageSetup({ server, checkpoint })
    } catch (failure) {
      setSetupStatus(errorMessage(failure))
    } finally {
      setChecking(false)
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault()
    await generate(input, mode)
  }

  async function generate(text: string, kind: StudioMessage['kind'], editedMessage?: StudioMessage) {
    const prompt = text.trim()
    if (!prompt || busy || loadingHistory || generation.current) return
    if (prompt.length > (kind === 'image' ? MAX_IMAGE_PROMPT_LENGTH : textLimit)) return
    setError('')
    setNotice('')
    if (kind === 'text') {
      const configurationError = getAIConfigurationError(settings)
      if (configurationError || !settings) {
        setError(configurationError || 'Set up a text provider in Settings.')
        return
      }
    } else if (window.api.isMock || (!imageSetup.checkpoint && imageSetup.server.trim() !== DEFAULT_IMAGE_SERVER)) {
      setSetupOpen(true)
      setError(window.api.isMock ? 'Open the desktop app to create images.' : 'Connect to ComfyUI and choose a checkpoint in Image setup.')
      return
    }

    const requestedAt = Date.now()
    const previous = messages
    const threadId = editedMessage ? crypto.randomUUID() : activeId ?? crypto.randomUUID()
    // Keep the original exchange and resend from the edited point in a separate chat.
    const earlier = editedMessage ? previous.slice(0, previous.findIndex(item => item.id === editedMessage.id))
      .map(item => ({ ...item, threadId, id: crypto.randomUUID() })) : []
    const question: StudioMessage = {
      id: crypto.randomUUID(), threadId, role: 'user', kind, content: prompt, createdAt: requestedAt,
    }
    const pending = [...(editedMessage ? earlier : previous), question]
    const controller = new AbortController()
    const imageId = kind === 'image' ? question.id : undefined
    const restore = () => {
      setMessages(previous)
      if (editedMessage) setEditingId(editedMessage.id)
      else setInput(prompt)
    }
    generation.current = { controller, imageId, restore }
    setMode(kind)
    setEditingId(null)
    setMessages(pending)
    if (!editedMessage) setInput('')
    setBusy(true)
    try {
      const image = imageId
        ? await window.api.studioImages.generate({ ...imageSetup, prompt, shape }, imageId)
        : undefined
      const content = kind === 'text' && settings ? await replyInStudio(settings, pending, controller.signal) : ''
      controller.signal.throwIfAborted()
      generation.current = null
      const reply: StudioMessage = {
        id: crypto.randomUUID(), threadId, role: 'assistant', kind, content,
        createdAt: Math.max(Date.now(), requestedAt + 1), image,
      }
      const thread = {
        id: threadId, userId, updatedAt: reply.createdAt,
        title: threads.find(item => item.id === threadId)?.title || prompt.replace(/\s+/g, ' ').slice(0, 64),
      }
      setActiveId(threadId)
      setMessages([...pending, reply])
      setThreads(current => [thread, ...current.filter(item => item.id !== threadId)])
      try {
        await saveStudioMessages(thread, ...earlier, question, reply)
      } catch {
        setError('The reply is available here, but the conversation could not be saved on this device.')
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        restore()
        setError(errorMessage(failure))
        if (kind === 'image' && !imageSetup.checkpoint) setSetupOpen(true)
      }
    } finally {
      if (!controller.signal.aborted) {
        generation.current = null
        setBusy(false)
      }
    }
  }

  async function stop() {
    const current = generation.current
    if (!current || current.controller.signal.aborted) return
    setStopping(true)
    current.controller.abort()
    // The image IPC may spend a moment waiting for ComfyUI to acknowledge the stop.
    try {
      if (current.imageId) await window.api.studioImages.cancel(current.imageId)
      setNotice(current.imageId ? 'Image generation stopped.' : 'Reply stopped.')
    } catch {
      setNotice('Stopped waiting. ComfyUI may still finish the image.')
    } finally {
      current.restore()
      generation.current = null
      setBusy(false)
      setStopping(false)
    }
  }

  async function saveEdit(message: StudioMessage) {
    const content = editText.trim()
    if (!content || busy || loadingHistory) return
    if (message.role === 'user') {
      await generate(content, message.kind, message)
      return
    }
    const thread = threads.find(item => item.id === message.threadId)
    if (!thread) return
    const updated = { ...message, content }
    setLoadingHistory(true)
    setError('')
    try {
      await saveStudioMessages(thread, updated)
      setMessages(current => current.map(item => item.id === updated.id ? updated : item))
      setEditingId(null)
      setNotice('Edit saved.')
    } catch {
      setError('Could not save the edited reply.')
    } finally {
      setLoadingHistory(false)
    }
  }

  function changeMode(next: typeof mode) {
    setMode(next)
    setError('')
  }

  const maxLength = mode === 'image' ? MAX_IMAGE_PROMPT_LENGTH : textLimit
  const activeTitle = threads.find(thread => thread.id === activeId)?.title

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-950 text-surface-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-800 bg-surface-900 px-5 py-3">
        <div className="min-w-0">
          <h1 className="font-serif text-xl font-semibold">AI Chat</h1>
          {activeTitle && <p className="max-w-sm truncate text-xs text-surface-400">{activeTitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={subtleButton} disabled={busy || checking} onClick={() => setSetupOpen(!setupOpen)} aria-expanded={setupOpen}>
            <Settings2 className="h-4 w-4" /> Image setup
          </button>
          <Link to="/settings" className={subtleButton}>AI settings</Link>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside aria-label="Conversation history" className="flex shrink-0 flex-col gap-2 overflow-hidden border-b border-surface-800 bg-surface-900 p-3 md:w-52 md:border-b-0 md:border-r">
          <button type="button" onClick={newChat} disabled={busy || loadingHistory} className={subtleButton}><Plus className="h-4 w-4" /> New chat</button>
          <div className="flex max-h-20 gap-1 overflow-auto md:max-h-none md:flex-col">
            {threads.map(thread => (
              <button
                key={thread.id} type="button" onClick={() => void openThread(thread)}
                disabled={busy || loadingHistory} aria-current={activeId === thread.id ? 'true' : undefined}
                title={thread.title}
                className={cn('max-w-52 shrink-0 truncate rounded-lg px-3 py-2 text-left text-sm disabled:opacity-50 md:max-w-none',
                  activeId === thread.id ? 'bg-surface-800 font-medium' : 'text-surface-400 hover:bg-surface-800')}
              >
                {thread.title}
              </button>
            ))}
          </div>
        </aside>
        <section aria-label="AI conversation" className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:px-7">
              {setupOpen && (
                <section aria-label="Image setup" className="mb-5 rounded-xl border border-surface-700 bg-surface-900 p-4">
                  <h2 className="text-sm font-semibold">ComfyUI connection</h2>
                  <p className="mb-3 mt-1 text-sm text-surface-400">The local setup starts ComfyUI and selects SDXL Base automatically. You can also connect an existing ComfyUI setup.</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex min-w-44 flex-1 flex-col gap-1 text-xs font-medium">
                      Server address
                      <input aria-label="ComfyUI server address" className={field} value={imageSetup.server} disabled={checking || busy} onChange={event => {
                        setModels([])
                        setSetupStatus('')
                        setImageSetup({ server: event.target.value, checkpoint: '' })
                      }} />
                    </label>
                    <button type="button" className={subtleButton} disabled={checking || busy || !imageSetup.server.trim()} onClick={() => void checkImageServer()}>
                      {checking ? 'Connecting…' : 'Find checkpoints'}
                    </button>
                  </div>
                  {!!checkpointOptions.length && (
                    <label className="mt-3 flex flex-col gap-1 text-xs font-medium">
                      Checkpoint
                      <select className={field} value={imageSetup.checkpoint} disabled={busy} onChange={event => saveImageSetup({ ...imageSetup, checkpoint: event.target.value })}>
                        <option value="">Choose a compatible checkpoint</option>
                        {checkpointOptions.map(name => <option value={name} key={name}>{name}</option>)}
                      </select>
                    </label>
                  )}
                  {!!setupStatus && <p role="status" className="mt-2 text-xs text-surface-400">{setupStatus}</p>}
                </section>
              )}
              {messages.length === 0 && !busy && (
                <div className="mx-auto my-auto max-w-lg py-8 text-center">
                  {mode === 'text'
                    ? <MessageSquare className="mx-auto mb-4 h-8 w-8 text-accent-600" aria-hidden />
                    : <ImagePlus className="mx-auto mb-4 h-8 w-8 text-accent-600" aria-hidden />}
                  <h2 className="font-serif text-3xl font-semibold">{mode === 'text' ? 'What are you working on?' : 'What would you like to create?'}</h2>
                  <p className="mt-2 text-sm text-surface-400">{mode === 'text' ? 'Start a conversation about anything you’re writing or exploring.' : 'Describe a cover, location, or other reference image.'}</p>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {(mode === 'text' ? chatExamples : imageExamples).map(example => (
                      <button type="button" key={example} onClick={() => { setInput(example); composer.current?.focus() }}
                        className="rounded-xl border border-surface-700 bg-surface-900 px-3 py-3 text-left text-sm hover:bg-surface-800">
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-5">
                {messages.map(message => (
                  <article key={message.id} aria-label={message.role === 'user' ? 'Your message' : 'AI reply'}
                    className={cn('min-w-0 text-sm leading-relaxed', message.role === 'user' ? 'ml-auto w-fit max-w-[85%]' : 'mr-auto w-full')}>
                    <div className={cn(message.role === 'user' && 'rounded-xl bg-surface-800 px-4 py-3')}>
                      {message.kind === 'image' && message.role === 'user' && <p className="mb-1 text-xs font-medium text-surface-400">Image prompt</p>}
                      {editingId === message.id ? (
                        <div className="min-w-[min(15rem,60vw)] space-y-2">
                          <textarea autoFocus aria-label="Edit message" className={cn(field, 'min-h-24 w-full resize-y')}
                            value={editText} onChange={event => setEditText(event.target.value)} disabled={busy || loadingHistory}
                          />
                          <div className="flex flex-wrap justify-end gap-1">
                            <button type="button" className={messageButton} onClick={() => setEditingId(null)} disabled={loadingHistory}>Cancel</button>
                            <button type="button" className={subtleButton} onClick={() => void saveEdit(message)}
                              disabled={busy || loadingHistory || !editText.trim() || editText.trim() === message.content ||
                                (message.role === 'user' && editText.trim().length > (message.kind === 'image' ? MAX_IMAGE_PROMPT_LENGTH : textLimit))}>
                              {message.role === 'user' ? 'Send in new chat' : 'Save edit'}
                            </button>
                          </div>
                        </div>
                      ) : message.content && <p className="select-text whitespace-pre-wrap break-words">{message.content}</p>}
                    </div>
                    {message.content && editingId !== message.id && (
                      <MessageActions
                        content={message.content}
                        createdAt={message.createdAt}
                        alignRight={message.role === 'user'}
                        disabled={busy || loadingHistory}
                        onEdit={() => {
                          setEditingId(message.id)
                          setEditText(message.content)
                          setNotice('')
                        }}
                        onCopyError={() => setNotice('Could not copy. Select the text to copy it manually.')}
                      />
                    )}
                    {message.image && (
                      <figure className="w-fit max-w-full overflow-hidden rounded-xl border border-surface-700 bg-surface-900">
                        <img src={message.image} alt="Image generated from your prompt" className="max-h-[54vh] max-w-full object-contain" />
                        <figcaption className="p-2">
                          <a href={message.image} download={'write-your-thoughts-' + message.id.slice(0, 8) + '.png'} className={subtleButton}>
                            <Download className="h-4 w-4" /> Save PNG
                          </a>
                        </figcaption>
                      </figure>
                    )}
                  </article>
                ))}
                {busy && <p role="status" className="flex items-center gap-2 text-sm text-surface-400"><Loader2 className="h-4 w-4 animate-spin" />{stopping ? 'Stopping…' : mode === 'image' ? 'Creating your image… Keep the app open while it renders.' : 'Writing a reply…'}</p>}
              </div>
              <div ref={endOfChat} />
            </div>
          </div>
          <form onSubmit={send} className="shrink-0 border-t border-surface-800 bg-surface-950 px-4 py-3">
            <div className="mx-auto max-w-3xl">
              {error && <p role="alert" className="mb-2 rounded-lg bg-error-500/10 p-2 text-sm text-error-400">{error}</p>}
              {notice && <p role="status" className="mb-2 text-xs text-surface-400">{notice}</p>}
              <div className="rounded-xl border border-surface-700 bg-surface-900 p-2">
                <textarea ref={composer} value={input} onChange={event => setInput(event.target.value)} maxLength={maxLength}
                  aria-label={mode === 'text' ? 'Chat message' : 'Image prompt'}
                  placeholder={mode === 'text' ? 'Write a message…' : 'Describe the image…'}
                  disabled={busy}
                  className="block w-full resize-none rounded-lg bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  rows={2}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                />
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <div role="group" aria-label="Compose mode" className="flex gap-1">
                    {(['text', 'image'] as const).map(option => (
                      <button key={option} type="button" aria-pressed={mode === option} disabled={busy}
                        className={cn('rounded-md px-2 py-1.5 text-xs font-medium', mode === option ? 'bg-surface-800' : 'text-surface-400 hover:bg-surface-800')}
                        onClick={() => changeMode(option)}>
                        {option === 'text' ? 'Chat' : 'Create image'}
                      </button>
                    ))}
                  </div>
                  {mode === 'image' && <select aria-label="Image shape" value={shape} disabled={busy} onChange={event => setShape(event.target.value as ImageShape)}
                    className="rounded-md border border-surface-700 bg-surface-950 px-2 py-1 text-xs">
                    <option value="square">Square</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option>
                  </select>}
                  {busy ? (
                    <button type="button" className={cn(subtleButton, 'ml-auto')} disabled={stopping || !generation.current} onClick={() => void stop()}>
                      <Square className="h-3.5 w-3.5" fill="currentColor" aria-hidden /> Stop
                    </button>
                  ) : (
                    <button type="submit" disabled={loadingHistory || !input.trim() || input.trim().length > maxLength}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg bg-accent-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-600 disabled:opacity-50">
                      {mode === 'text' ? 'Send' : 'Generate'} <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
                {input.trim().length > maxLength && <p className="px-2 text-xs text-surface-400">Shorten this prompt to {maxLength.toLocaleString()} characters.</p>}
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
