import { AIBrainstormMessage } from '../../types'
import { BaseProvider, ProviderResponse } from './BaseProvider'

export class OpenAIProvider extends BaseProvider {
  async testConnection(): Promise<boolean> {
    const models = await this.getAvailableModels()
    return models.length > 0
  }

  async getAvailableModels(): Promise<string[]> {
    if (!this.settings.apiKey) throw new Error('Missing API Key')
    
    let apiKey = this.settings.apiKey.trim()
    
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    })
    
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
    const defaultModel = 'gpt-4o-mini'
    if (availableModels.includes(defaultModel)) return defaultModel
    if (availableModels.includes('gpt-4o')) return 'gpt-4o'
    if (availableModels.includes('gpt-3.5-turbo')) return 'gpt-3.5-turbo'
    return availableModels.find(m => m.includes('gpt')) || defaultModel
  }

  async generateText(systemPrompt: string, messages: AIBrainstormMessage[]): Promise<ProviderResponse> {
    if (!this.settings.apiKey) throw new Error('Missing API Key')
    
    let apiKey = this.settings.apiKey.trim()

    const bodyObj: any = {
      model: this.settings.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: this.settings.temperature ?? 0.7,
    }

    if (this.settings.maxTokens) bodyObj.max_tokens = this.settings.maxTokens
    if (this.settings.topP !== undefined) bodyObj.top_p = this.settings.topP

    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyObj),
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
        throw new Error(`OpenAI API error: ${response.status} - ${errText}`)
      }
    }

    const data = await response.json()
    return {
      content: data.choices[0].message.content
    }
  }

  async generateJSON(systemPrompt: string, content: string): Promise<any> {
    if (!this.settings.apiKey) throw new Error('Missing API Key')
    let apiKey = this.settings.apiKey.trim()

    const bodyObj: any = {
      model: this.settings.model || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content.substring(0, 30000) }
      ],
      temperature: this.settings.temperature ?? 0.3,
    }

    if (this.settings.maxTokens) bodyObj.max_tokens = this.settings.maxTokens
    if (this.settings.topP !== undefined) bodyObj.top_p = this.settings.topP

    let response: Response
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyObj),
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
        throw new Error(`OpenAI API error: ${response.status} - ${errText}`)
      }
    }

    const data = await response.json()
    const jsonResponse = data.choices[0].message.content
    try {
      return JSON.parse(jsonResponse)
    } catch {
      throw new Error('Failed to parse JSON from OpenAI response')
    }
  }
}
