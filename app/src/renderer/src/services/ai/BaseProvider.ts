import { AIBrainstormMessage, ProviderSettings } from '../../types'

export interface ProviderResponse {
  content: string
}

export interface VisionImageInput {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  base64: string
  dataUrl: string
}

export function parseModelJson(raw: string, providerLabel: string): any {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        // Fall through to clean error below
      }
    }
    throw new Error(`Failed to parse JSON from ${providerLabel} response`)
  }
}

export interface IAIProvider {
  /** Test the connection to the provider. Returns true if successful, throws error if not. */
  testConnection(): Promise<boolean>

  /** Generate plain text or markdown response. */
  generateText(systemPrompt: string, messages: AIBrainstormMessage[], signal?: AbortSignal): Promise<ProviderResponse>

  /** Generate JSON response. Returns parsed JSON object. */
  generateJSON(systemPrompt: string, content: string): Promise<any>

  /** Generate JSON response from an image plus prompt. */
  generateJSONWithImage(systemPrompt: string, prompt: string, image: VisionImageInput, signal?: AbortSignal): Promise<any>

  /** Fetch available models from the provider's API. Returns empty array if not supported. */
  getAvailableModels(): Promise<string[]>

  /** Selects the best recommended model from the available models list, or returns a default. */
  getRecommendedModel(availableModels: string[]): string
}

export abstract class BaseProvider implements IAIProvider {
  protected settings: ProviderSettings

  constructor(settings: ProviderSettings) {
    this.settings = settings
  }

  abstract testConnection(): Promise<boolean>
  abstract generateText(systemPrompt: string, messages: AIBrainstormMessage[], signal?: AbortSignal): Promise<ProviderResponse>
  abstract generateJSON(systemPrompt: string, content: string): Promise<any>
  abstract generateJSONWithImage(systemPrompt: string, prompt: string, image: VisionImageInput, signal?: AbortSignal): Promise<any>
  abstract getAvailableModels(): Promise<string[]>
  abstract getRecommendedModel(availableModels: string[]): string
}
