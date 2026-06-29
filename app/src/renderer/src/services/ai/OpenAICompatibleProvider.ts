import { AIBrainstormMessage } from '../../types'
import { BaseProvider, ProviderResponse } from './BaseProvider'

export class OpenAICompatibleProvider extends BaseProvider {
  private getBaseUrl(): string {
    return this.settings.baseUrl || 'https://api.openai.com/v1'
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    
    let apiKey = this.settings.apiKey
    if (typeof apiKey === 'string') {
      apiKey = apiKey.trim()
    }

    const isGroq = this.getBaseUrl().includes('api.groq.com')

    if (!apiKey && isGroq) {
      throw new Error('Missing Authorization header: Groq requires an API key.')
    }

    if (apiKey) {
      if (isGroq && !apiKey.startsWith('gsk_')) {
        throw new Error('Invalid API key: Groq API keys must begin with "gsk_"')
      }
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    if (this.settings.customHeaders) {
      Object.assign(headers, this.settings.customHeaders)
    }

    return headers
  }

  async testConnection(): Promise<boolean> {
    const models = await this.getAvailableModels()
    return true
  }

  async getAvailableModels(): Promise<string[]> {
    const url = `${this.getBaseUrl().replace(/\/$/, '')}/models`
    
    let response: Response
    try {
      response = await fetch(url, { headers: this.getHeaders() })
    } catch (err: any) {
      throw new Error(`Network Error: ${err.message}`)
    }
    
    if (!response.ok) {
      const errText = await response.text()
      try {
        const errJson = JSON.parse(errText)
        let errorMsg = errJson.error?.message || `API error (${response.status})`
        if (response.status === 401) throw new Error(`Invalid API Key: ${errorMsg}`)
        if (response.status === 429) throw new Error(`Rate Limit Exceeded: ${errorMsg}`)
        throw new Error(errorMsg)
      } catch (e: any) {
        if (e.message.includes('Invalid API Key') || e.message.includes('Rate Limit')) throw e
        // If models endpoint isn't supported (e.g. some custom providers), we return empty instead of failing completely.
        if (response.status === 404) return []
        throw new Error(`Network Error: ${response.status} - ${errText}`)
      }
    }
    
    const data = await response.json()
    if (data && data.data && Array.isArray(data.data)) {
      return data.data.map((m: any) => m.id)
    }
    return []
  }

  getRecommendedModel(availableModels: string[]): string {
    const providerId = (this.settings as any)._providerId || 'custom'
    
    switch (providerId) {
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
        if (availableModels.includes('llama3.2:latest')) return 'llama3.2:latest'
        if (availableModels.includes('llama3.2')) return 'llama3.2'
        return availableModels[0] || ''
      case 'lmstudio':
        return availableModels[0] || ''
      default:
        return availableModels[0] || ''
    }
  }

  async generateText(systemPrompt: string, messages: AIBrainstormMessage[]): Promise<ProviderResponse> {
    const url = `${this.getBaseUrl().replace(/\/$/, '')}/chat/completions`
    const headers = this.getHeaders()
    const bodyObj: any = {
      model: this.settings.model || 'default',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: this.settings.temperature ?? 0.7,
    }

    if (this.settings.maxTokens) bodyObj.max_tokens = this.settings.maxTokens
    if (this.settings.topP !== undefined) bodyObj.top_p = this.settings.topP

    console.log('Provider:', (this.settings as any)._providerId || 'Unknown')
    console.log('Endpoint:', url)
    console.log('API Key Present:', !!headers['Authorization'] ? 'Yes' : 'No')
    if (headers['Authorization']) {
      const token = headers['Authorization'].replace('Bearer ', '')
      console.log('API Key Prefix:', token.substring(0, 4))
    }
    console.log('--- OUTGOING REQUEST ---')
    console.log('URL:', url)
    const safeHeaders = { ...headers }
    if (safeHeaders['Authorization']) safeHeaders['Authorization'] = 'Bearer [REDACTED]'
    console.log('Headers:', safeHeaders)
    console.log('Body:', JSON.stringify(bodyObj, null, 2))
    console.log('------------------------')

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyObj),
      })
    } catch (err: any) {
      throw new Error(`Network failure: ${err.message}`)
    }

    if (!response.ok) {
      const errText = await response.text()
      console.error('HTTP Error Response Body:', errText)
      try {
        const errJson = JSON.parse(errText)
        let errorMsg = errJson.error?.message || `API error (${response.status})`
        if (response.status === 401) throw new Error(`Invalid API Key: ${errorMsg}`)
        if (response.status === 404) throw new Error(`Model Not Found: ${errorMsg}`)
        if (response.status === 429) throw new Error(`Quota/Rate Limit Exceeded: ${errorMsg}`)
        throw new Error(errorMsg)
      } catch (e: any) {
        if (e.message.includes('Invalid API Key') || e.message.includes('Model Not Found') || e.message.includes('Quota')) throw e
        throw new Error(`API error: ${response.status} - ${errText}`)
      }
    }

    const data = await response.json()
    return {
      content: data.choices[0]?.message?.content || ''
    }
  }

  async generateJSON(systemPrompt: string, content: string): Promise<any> {
    const url = `${this.getBaseUrl().replace(/\/$/, '')}/chat/completions`
    
    // Some providers don't support json_object format, so we instruct via prompt
    const finalSystemPrompt = systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON, starting with { and ending with }.'
    
    const body: any = {
      model: this.settings.model || 'default',
      messages: [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: content.substring(0, 30000) }
      ],
      temperature: this.settings.temperature ?? 0.3,
    }

    if (this.settings.maxTokens) body.max_tokens = this.settings.maxTokens
    if (this.settings.topP !== undefined) body.top_p = this.settings.topP

    // Try applying response_format if not specifically known to fail, but for compatibility 
    // it's safer to rely on prompting for generic OpenAI compatible endpoints if they don't support it.
    // We'll add it, but if it fails, the user might need to change providers. 
    // For now, let's keep it simple and just use standard completions with prompt forcing.
    
    const headers = this.getHeaders()
    console.log('Provider:', (this.settings as any)._providerId || 'Unknown')
    console.log('Endpoint:', url)
    console.log('API Key Present:', !!headers['Authorization'] ? 'Yes' : 'No')
    if (headers['Authorization']) {
      const token = headers['Authorization'].replace('Bearer ', '')
      console.log('API Key Prefix:', token.substring(0, 4))
    }
    console.log('--- OUTGOING REQUEST (JSON) ---')
    console.log('URL:', url)
    const safeHeaders = { ...headers }
    if (safeHeaders['Authorization']) safeHeaders['Authorization'] = 'Bearer [REDACTED]'
    console.log('Headers:', safeHeaders)
    console.log('Body:', JSON.stringify(body, null, 2))
    console.log('-------------------------------')

    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
    } catch (err: any) {
      throw new Error(`Network failure: ${err.message}`)
    }

    if (!response.ok) {
      const errText = await response.text()
      try {
        const errJson = JSON.parse(errText)
        let errorMsg = errJson.error?.message || `API error (${response.status})`
        if (response.status === 401) throw new Error(`Invalid API Key: ${errorMsg}`)
        if (response.status === 404) throw new Error(`Model Not Found: ${errorMsg}`)
        if (response.status === 429) throw new Error(`Quota/Rate Limit Exceeded: ${errorMsg}`)
        throw new Error(errorMsg)
      } catch (e: any) {
        if (e.message.includes('Invalid API Key') || e.message.includes('Model Not Found') || e.message.includes('Quota')) throw e
        throw new Error(`API error: ${response.status} - ${errText}`)
      }
    }

    const data = await response.json()
    const jsonResponse = data.choices[0]?.message?.content || ''
    const cleanedJson = jsonResponse.replace(/^```json/g, '').replace(/```$/g, '').trim()
    
    try {
      return JSON.parse(cleanedJson)
    } catch {
      throw new Error('Failed to parse JSON from response')
    }
  }
}
