import { AIBrainstormMessage, ProviderSettings } from '../../types'

export interface ProviderResponse {
  content: string
}

export interface IAIProvider {
  /** Test the connection to the provider. Returns true if successful, throws error if not. */
  testConnection(): Promise<boolean>

  /** Generate plain text or markdown response. */
  generateText(systemPrompt: string, messages: AIBrainstormMessage[]): Promise<ProviderResponse>

  /** Generate JSON response. Returns parsed JSON object. */
  generateJSON(systemPrompt: string, content: string): Promise<any>

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
  abstract generateText(systemPrompt: string, messages: AIBrainstormMessage[]): Promise<ProviderResponse>
  abstract generateJSON(systemPrompt: string, content: string): Promise<any>
  abstract getAvailableModels(): Promise<string[]>
  abstract getRecommendedModel(availableModels: string[]): string
}
