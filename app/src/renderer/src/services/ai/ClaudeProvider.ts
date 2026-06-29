import { AIBrainstormMessage } from '../../types'
import { BaseProvider, ProviderResponse } from './BaseProvider'

export class ClaudeProvider extends BaseProvider {
  async testConnection(): Promise<boolean> {
    const models = await this.getAvailableModels()
    return models.length > 0
  }

  async getAvailableModels(): Promise<string[]> {
    if (!this.settings.apiKey) throw new Error('Missing API Key')
    let apiKey = this.settings.apiKey.trim()

    let response: Response
    try {
      response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      })
    } catch (err: any) {
      throw new Error(`Network Error: ${err.message}`)
    }
    
    if (!response.ok) {
      if (response.status === 404) {
        // Fallback for older API versions that don't support /models
        return ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest']
      }
      
      const errText = await response.text()
      try {
        const errJson = JSON.parse(errText)
        let errorMsg = errJson.error?.message || `API error (${response.status})`
        if (response.status === 401) throw new Error(`Invalid API Key: ${errorMsg}`)
        if (response.status === 429) throw new Error(`Rate Limit Exceeded: ${errorMsg}`)
        throw new Error(errorMsg)
      } catch (e: any) {
        if (e.message.includes('Invalid API Key') || e.message.includes('Rate Limit')) throw e
        throw new Error(`Network Error: ${response.status} - ${errText}`)
      }
    }
    
    const data = await response.json()
    if (data && data.data && Array.isArray(data.data)) {
      return data.data.map((m: any) => m.id)
    }
    return ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest']
  }

  getRecommendedModel(availableModels: string[]): string {
    const defaultModel = 'claude-3-5-sonnet-latest'
    if (availableModels.includes(defaultModel)) return defaultModel
    if (availableModels.some(m => m.includes('sonnet'))) return availableModels.find(m => m.includes('sonnet'))!
    return availableModels[0] || defaultModel
  }

  async generateText(systemPrompt: string, messages: AIBrainstormMessage[]): Promise<ProviderResponse> {
    if (!this.settings.apiKey) throw new Error('Missing API Key')
    let apiKey = this.settings.apiKey.trim()
    
    const bodyObj: any = {
      model: this.settings.model || 'claude-3-5-sonnet-latest',
      system: systemPrompt,
      messages: messages,
      max_tokens: this.settings.maxTokens || 4096
    }

    if (this.settings.temperature !== undefined) bodyObj.temperature = this.settings.temperature
    if (this.settings.topP !== undefined) bodyObj.top_p = this.settings.topP

    let response: Response
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(bodyObj)
      })
    } catch (err: any) {
      throw new Error(`Network Error: ${err.message}`)
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
        throw new Error(`Claude API error: ${response.status} - ${errText}`)
      }
    }

    const data = await response.json()
    return {
      content: data.content[0].text
    }
  }

  async generateJSON(systemPrompt: string, content: string): Promise<any> {
    if (!this.settings.apiKey) throw new Error('Missing API Key')
    let apiKey = this.settings.apiKey.trim()

    const bodyObj: any = {
      model: this.settings.model || 'claude-3-5-sonnet-latest',
      system: systemPrompt + '\n\nIMPORTANT: Return ONLY valid JSON, starting with { and ending with }.',
      messages: [{ role: 'user', content: content.substring(0, 30000) }],
      max_tokens: this.settings.maxTokens || 4096
    }

    if (this.settings.temperature !== undefined) bodyObj.temperature = this.settings.temperature
    if (this.settings.topP !== undefined) bodyObj.top_p = this.settings.topP

    let response: Response
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(bodyObj)
      })
    } catch (err: any) {
      throw new Error(`Network Error: ${err.message}`)
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
        throw new Error(`Claude API error: ${response.status} - ${errText}`)
      }
    }

    const data = await response.json()
    const jsonResponse = data.content[0].text.replace(/^```json/g, '').replace(/```$/g, '').trim()
    try {
      return JSON.parse(jsonResponse)
    } catch {
      throw new Error('Failed to parse JSON from Claude response')
    }
  }
}
