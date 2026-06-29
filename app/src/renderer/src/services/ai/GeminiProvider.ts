import { AIBrainstormMessage } from '../../types'
import { BaseProvider, ProviderResponse } from './BaseProvider'

export class GeminiProvider extends BaseProvider {
  async testConnection(): Promise<boolean> {
    const models = await this.getAvailableModels()
    return models.length > 0
  }

  async getAvailableModels(): Promise<string[]> {
    if (!this.settings.apiKey) throw new Error('Missing API Key')
    let apiKey = this.settings.apiKey.trim()

    let response: Response
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    } catch (err: any) {
      throw new Error(`Network Error: ${err.message}`)
    }
    
    if (!response.ok) {
      const errText = await response.text()
      try {
        const errJson = JSON.parse(errText)
        let errorMsg = errJson.error?.message || `API error (${response.status})`
        if (response.status === 400 && errorMsg.includes('API key not valid')) throw new Error(`Invalid API Key: ${errorMsg}`)
        if (response.status === 429) throw new Error(`Rate Limit Exceeded: ${errorMsg}`)
        throw new Error(errorMsg)
      } catch (e: any) {
        if (e.message.includes('Invalid API Key') || e.message.includes('Rate Limit')) throw e
        throw new Error(`Network Error: ${response.status} - ${errText}`)
      }
    }
    
    const data = await response.json()
    if (data && data.models && Array.isArray(data.models)) {
      return data.models.map((m: any) => m.name) // e.g. models/gemini-2.5-flash
    }
    return []
  }

  getRecommendedModel(availableModels: string[]): string {
    const defaultModel = 'gemini-2.5-flash'
    const fullDefault = `models/${defaultModel}`
    if (availableModels.includes(fullDefault) || availableModels.includes(defaultModel)) return defaultModel
    if (availableModels.some(m => m.includes('gemini-2.0-flash'))) return 'gemini-2.0-flash'
    return availableModels.find(m => m.includes('gemini'))?.replace('models/', '') || defaultModel
  }

  async generateText(systemPrompt: string, messages: AIBrainstormMessage[]): Promise<ProviderResponse> {
    if (!this.settings.apiKey) throw new Error('Missing API Key')
    let apiKey = this.settings.apiKey.trim()
    
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))

    const modelName = this.settings.model || 'gemini-2.5-flash'
    const cleanModelName = modelName.startsWith('models/') ? modelName.replace('models/', '') : modelName

    const bodyObj: any = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
    }

    if (this.settings.temperature !== undefined || this.settings.maxTokens || this.settings.topP !== undefined) {
      bodyObj.generationConfig = {}
      if (this.settings.temperature !== undefined) bodyObj.generationConfig.temperature = this.settings.temperature
      if (this.settings.maxTokens) bodyObj.generationConfig.maxOutputTokens = this.settings.maxTokens
      if (this.settings.topP !== undefined) bodyObj.generationConfig.topP = this.settings.topP
    }

    let response: Response
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj),
        }
      )
    } catch (err: any) {
      throw new Error(`Network Error: ${err.message}`)
    }

    if (!response.ok) {
      const errText = await response.text()
      try {
        const errJson = JSON.parse(errText)
        let errorMsg = errJson.error?.message || `API error (${response.status})`
        if (response.status === 400 && errorMsg.includes('API key not valid')) throw new Error(`Invalid API Key: ${errorMsg}`)
        if (response.status === 404) throw new Error(`Model Not Found: ${errorMsg}`)
        if (response.status === 429) throw new Error(`Quota/Rate Limit Exceeded: ${errorMsg}`)
        throw new Error(errorMsg)
      } catch (e: any) {
        if (e.message.includes('Invalid API Key') || e.message.includes('Model Not Found') || e.message.includes('Quota')) throw e
        throw new Error(`Gemini API error: ${response.status} - ${errText}`)
      }
    }

    const data = await response.json()
    return {
      content: data.candidates[0].content.parts[0].text
    }
  }

  async generateJSON(systemPrompt: string, content: string): Promise<any> {
    if (!this.settings.apiKey) throw new Error('Missing API Key')
    let apiKey = this.settings.apiKey.trim()

    const modelName = this.settings.model || 'gemini-2.5-flash'
    const cleanModelName = modelName.startsWith('models/') ? modelName.replace('models/', '') : modelName

    const bodyObj: any = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: content.substring(0, 30000) }] }],
      generationConfig: { responseMimeType: 'application/json' }
    }

    if (this.settings.temperature !== undefined) bodyObj.generationConfig.temperature = this.settings.temperature
    if (this.settings.maxTokens) bodyObj.generationConfig.maxOutputTokens = this.settings.maxTokens
    if (this.settings.topP !== undefined) bodyObj.generationConfig.topP = this.settings.topP

    let response: Response
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj)
        }
      )
    } catch (err: any) {
      throw new Error(`Network Error: ${err.message}`)
    }

    if (!response.ok) {
      const errText = await response.text()
      try {
        const errJson = JSON.parse(errText)
        let errorMsg = errJson.error?.message || `API error (${response.status})`
        if (response.status === 400 && errorMsg.includes('API key not valid')) throw new Error(`Invalid API Key: ${errorMsg}`)
        if (response.status === 404) throw new Error(`Model Not Found: ${errorMsg}`)
        if (response.status === 429) throw new Error(`Quota/Rate Limit Exceeded: ${errorMsg}`)
        throw new Error(errorMsg)
      } catch (e: any) {
        if (e.message.includes('Invalid API Key') || e.message.includes('Model Not Found') || e.message.includes('Quota')) throw e
        throw new Error(`Gemini API error: ${response.status} - ${errText}`)
      }
    }

    const data = await response.json()
    const jsonResponse = data.candidates[0].content.parts[0].text.replace(/^```json/g, '').replace(/```$/g, '').trim()
    try {
      return JSON.parse(jsonResponse)
    } catch {
      throw new Error('Failed to parse JSON from Gemini response')
    }
  }
}
