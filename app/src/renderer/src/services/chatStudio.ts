import type { Settings } from '../types'
import { ProviderFactory } from './ai/ProviderFactory'
import { isLocalAIProvider, resolveAISettings } from './ai/configuration'

export interface StudioThread {
  id: string
  userId: string
  title: string
  updatedAt: number
}

export interface StudioMessage {
  id: string
  threadId: string
  role: 'user' | 'assistant'
  kind: 'text' | 'image'
  content: string
  createdAt: number
  image?: string
}

let database: Promise<IDBDatabase> | undefined

function openHistory() {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('wyt-chat-studio', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        db.createObjectStore('threads', { keyPath: 'id' }).createIndex('userId', 'userId')
        db.createObjectStore('messages', { keyPath: 'id' }).createIndex('threadId', 'threadId')
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('Close other app windows and reopen the chat.'))
    }).catch(error => {
      database = undefined
      throw error
    })
  }
  return database
}

async function readHistory<T>(store: string, index: string, key: string): Promise<T[]> {
  const db = await openHistory()
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).index(index).getAll(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getStudioThreads(userId: string) {
  const threads = await readHistory<StudioThread>('threads', 'userId', userId)
  return threads.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getStudioMessages(threadId: string) {
  const messages = await readHistory<StudioMessage>('messages', 'threadId', threadId)
  return messages.sort((a, b) => a.createdAt - b.createdAt || b.role.localeCompare(a.role))
}

export async function saveStudioMessages(thread: StudioThread, ...messages: StudioMessage[]) {
  const db = await openHistory()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['threads', 'messages'], 'readwrite')
    const threads = transaction.objectStore('threads')
    const existing = threads.get(thread.id)
    existing.onsuccess = () => {
      if (!existing.result || existing.result.updatedAt <= thread.updatedAt) threads.put(thread)
    }
    const store = transaction.objectStore('messages')
    for (const message of messages) store.put(message)
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Could not save this chat.'))
  })
}

export async function replyInStudio(settings: Settings, messages: StudioMessage[], signal?: AbortSignal) {
  const provider = settings.ai_provider || 'openai'
  const options = resolveAISettings(provider, settings.ai_api_key, settings.ai_settings)
  const local = isLocalAIProvider(provider, options.baseUrl)
  let budget = local ? 8000 : 30_000
  const recent = messages.filter(message => message.kind === 'text').slice(-20)
  let start = recent.length
  while (start > 0 && recent[start - 1].content.length <= budget) {
    budget -= recent[--start].content.length
  }
  const context = recent.slice(start)
  if (context[0]?.role === 'assistant') context.shift()
  const ai = ProviderFactory.create(provider, options)
  const result = await ai.generateText(
    'You are the general chat assistant in Write Your Thoughts. Help with questions, creative writing, and planning. You receive only the messages written in this chat. Acknowledge missing information and make clear when a story detail is a suggestion. The app has a separate Create image mode; do not claim to have generated an image in a text reply.',
    context.map(({ role, content }) => ({ role, content })),
    signal,
  )
  if (!result.content?.trim()) throw new Error('The AI returned an empty reply.')
  return result.content.trim()
}
