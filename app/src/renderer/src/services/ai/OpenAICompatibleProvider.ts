import type { AIProvider, AIBrainstormMessage, ProviderSettings } from '../../types'
import { BaseProvider, parseModelJson, type ProviderResponse, type VisionImageInput } from './BaseProvider'
import { isLocalAIProvider, isOllamaCloudModel } from './configuration'

export class OpenAICompatibleProvider extends BaseProvider {
  constructor(private readonly provider: AIProvider, settings: ProviderSettings) {
    super(settings)
  }

  private get local(): boolean {
    return isLocalAIProvider(this.provider, this.settings.baseUrl)
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const apiKey = this.settings.apiKey?.trim()

    if (this.provider === 'groq') {
      if (!apiKey) throw new Error('Groq requires an API key.')
      if (!apiKey.startsWith('gsk_')) throw new Error('Groq API keys must begin with "gsk_".')
    }

    if (apiKey) headers.Authorization = 'Bearer ' + apiKey
    return { ...headers, ...this.settings.customHeaders }
  }

  private async request(body?: string, signal?: AbortSignal): Promise<{ status: number; body: string }> {
    const baseUrl = (this.settings.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
    const headers = this.getHeaders()
    const timeout = body === undefined ? 8000 : this.settings.timeout || 240_000
    signal?.throwIfAborted()
    try {
      if (this.local && !window.api?.isMock && window.api?.localAI) {
        const requestId = signal ? crypto.randomUUID() : undefined
        const cancel = () => { if (requestId) void window.api.localAI.cancel(requestId).catch(() => {}) }
        signal?.addEventListener('abort', cancel, { once: true })
        try {
          return await window.api.localAI.request({ baseUrl, headers, body, timeout, requestId })
        } finally {
          signal?.removeEventListener('abort', cancel)
        }
      }
      const suffix = body === undefined ? '/models' : '/chat/completions'
      const timer = this.local ? AbortSignal.timeout(timeout) : undefined
      const response = await fetch(baseUrl + suffix, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body,
        signal: timer && signal ? AbortSignal.any([timer, signal]) : timer ?? signal,
        redirect: this.local ? 'error' : 'follow',
      })
      return { status: response.status, body: await response.text() }
    } catch (error) {
      signal?.throwIfAborted()
      if (!this.local) throw error
      const server = this.provider === 'ollama' ? 'Ollama' : this.provider === 'lmstudio' ? 'LM Studio' : 'your local AI server'
      const timedOut = error instanceof Error && /timeout|timed out|aborted/i.test(error.message)
      throw new Error(timedOut
        ? 'Local AI took too long. Try a shorter passage or increase the timeout in AI settings.'
        : 'Could not reach ' + server + '. Make sure it is running and check the Base URL in AI settings.')
    }
  }

  private parseResponse(status: number, body: string) {
    let data
    try { data = JSON.parse(body) } catch { /* Some servers send plain-text errors. */ }
    if (status >= 200 && status < 300 && data) return data

    const error = data?.error
    const message = error?.message || (typeof error === 'string' ? error : '') || body.slice(0, 240)
    if (status === 401) throw new Error('Invalid API key' + (message ? ' — ' + message : ''))
    if (status === 429) throw new Error('Rate limit exceeded' + (message ? ' — ' + message : ''))
    throw new Error(message || 'AI server returned HTTP ' + status)
  }

  async testConnection(): Promise<boolean> {
    await this.getAvailableModels()
    return true
  }

  async getAvailableModels(signal?: AbortSignal): Promise<string[]> {
    const response = await this.request(undefined, signal)
    if (response.status === 404 && !this.local) return []
    const data = this.parseResponse(response.status, response.body)
    const models: string[] = Array.isArray(data?.data)
      ? data.data.flatMap((model: { id?: unknown }) => typeof model?.id === 'string' ? [model.id] : [])
      : []
    return this.provider === 'ollama' ? models.filter(model => !isOllamaCloudModel(model)) : models
  }

  getRecommendedModel(availableModels: string[]): string {
    switch (this.provider) {
      case 'groq':
        if (availableModels.includes('llama-3.3-70b-versatile')) return 'llama-3.3-70b-versatile'
        return availableModels[0] || 'llama-3.3-70b-versatile'
      case 'openrouter':
        if (availableModels.includes('meta-llama/llama-3.3-70b-instruct:free')) return 'meta-llama/llama-3.3-70b-instruct:free'
        return availableModels[0] || 'meta-llama/llama-3.3-70b-instruct:free'
      case 'mistral':
        if (availableModels.includes('mistral-medium-latest')) return 'mistral-medium-latest'
        return availableModels.find(m => m.includes('chat')) || availableModels[0] || 'mistral-medium-latest'
      case 'together':
        if (availableModels.includes('meta-llama/Llama-3.3-70B-Instruct-Turbo')) return 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
        return availableModels[0] || 'meta-llama/Llama-3.3-70B-Instruct-Turbo'
      case 'xai':
        if (availableModels.includes('grok-3-mini')) return 'grok-3-mini'
        return availableModels[0] || 'grok-3-mini'
      case 'ollama':
        return availableModels.find(model => model === 'qwen2.5:7b' || model === 'qwen2.5:3b') ||
          availableModels.find(model => model === 'llama3.2:latest' || model === 'llama3.2') ||
          availableModels[0] || ''
      default:
        return availableModels[0] || ''
    }
  }

  private async complete(systemPrompt: string, messages: AIBrainstormMessage[], json: boolean, signal?: AbortSignal) {
    if (this.local && systemPrompt.length + messages.reduce((length, message) => length + message.content.length, 0) > 10_000) {
      throw new Error('This request is too large for the local AI limit. Try a shorter selection, fewer chapters, or less reference material.')
    }
    const model = this.settings.model?.trim() || (this.local
      ? this.getRecommendedModel(await this.getAvailableModels(signal))
      : 'default')
    if (!model) throw new Error('No local model found. Download a model and select it in AI Settings.')
    if (this.provider === 'ollama' && isOllamaCloudModel(model)) {
      throw new Error('This Ollama model requires internet access. Select a model downloaded to this device.')
    }

    const body = JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: this.settings.temperature ?? (json ? 0.3 : 0.7),
      max_tokens: this.settings.maxTokens || (this.local ? (json ? 1800 : 800) : undefined),
      top_p: this.settings.topP,
      response_format: json && this.provider === 'ollama' ? { type: 'json_object' } : undefined,
    })

    const response = await this.request(body, signal)
    if (response.status === 404 && this.local) {
      throw new Error('Local model "' + model + '" is unavailable. Check that it is installed and selected in AI Settings.')
    }
    const choice = this.parseResponse(response.status, response.body).choices?.[0]
    const content = choice?.message?.content
    if (this.local && json && choice?.finish_reason === 'length') {
      throw new Error('The AI response reached its length limit. Try a shorter passage or increase Max Tokens.')
    }
    if (typeof content !== 'string' || !content.trim()) throw new Error('The AI returned an empty response.')
    return content
  }

  async generateText(systemPrompt: string, messages: AIBrainstormMessage[], signal?: AbortSignal): Promise<ProviderResponse> {
    return { content: await this.complete(systemPrompt, messages, false, signal) }
  }

  async generateJSON(systemPrompt: string, content: string): Promise<any> {
    const prompt = systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON, starting with { and ending with }.'
    const result = await this.complete(prompt, [{ role: 'user', content: this.local ? content : content.slice(0, 30_000) }], true)
    try {
      return parseModelJson(result, this.provider)
    } catch {
      throw new Error('The AI returned invalid JSON. Try again or choose a model that follows structured instructions reliably.')
    }
  }

  async generateJSONWithImage(systemPrompt: string, prompt: string, image: VisionImageInput, signal?: AbortSignal): Promise<any> {
    if (this.local && systemPrompt.length + prompt.length > 10_000) {
      throw new Error('This request is too large for the local AI limit.')
    }
    const model = this.settings.model?.trim() || (this.local
      ? this.getRecommendedModel(await this.getAvailableModels(signal))
      : 'default')
    if (!model) throw new Error('No local model found. Download a model and select it in AI Settings.')
    if (this.provider === 'ollama' && isOllamaCloudModel(model)) {
      throw new Error('This Ollama model requires internet access. Select a model downloaded to this device.')
    }

    const systemWithJson = systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON, starting with { and ending with }.'
    const body = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemWithJson },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image.dataUrl } },
          ],
        },
      ],
      temperature: this.settings.temperature ?? 0.2,
      max_tokens: this.settings.maxTokens || (this.local ? 3200 : 4096),
      top_p: this.settings.topP,
      response_format: this.provider === 'ollama' ? { type: 'json_object' } : undefined,
    })

    const response = await this.request(body, signal)
    if (response.status === 404 && this.local) {
      throw new Error('Local model "' + model + '" is unavailable. Check that it is installed and selected in AI Settings.')
    }
    const choice = this.parseResponse(response.status, response.body).choices?.[0]
    const content = choice?.message?.content
    if (this.local && choice?.finish_reason === 'length') {
      throw new Error('The AI response reached its length limit. Try increasing Max Tokens.')
    }
    if (typeof content !== 'string' || !content.trim()) throw new Error('The AI returned an empty response.')
    try {
      return parseModelJson(content, this.provider)
    } catch {
      throw new Error('The AI returned invalid JSON. Try again or choose a vision model that supports structured JSON.')
    }
  }
}
