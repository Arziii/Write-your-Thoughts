import { AIProvider, ProviderSettings } from '../../types'
import { IAIProvider } from './BaseProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { GeminiProvider } from './GeminiProvider'
import { ClaudeProvider } from './ClaudeProvider'
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider'

export class ProviderFactory {
  static create(providerId: AIProvider, settings: ProviderSettings): IAIProvider {
    const enhancedSettings = { ...settings, _providerId: providerId } as any;
    switch (providerId) {
      case 'openai':
        return new OpenAIProvider(enhancedSettings)
      case 'gemini':
        return new GeminiProvider(enhancedSettings)
      case 'claude':
        return new ClaudeProvider(enhancedSettings)
      case 'groq':
        return new OpenAICompatibleProvider({
          ...enhancedSettings,
          baseUrl: 'https://api.groq.com/openai/v1'
        })
      case 'openrouter':
        return new OpenAICompatibleProvider({
          ...enhancedSettings,
          baseUrl: 'https://openrouter.ai/api/v1',
          customHeaders: {
            'HTTP-Referer': settings.customHeaders?.referer || window.location.href,
            'X-Title': settings.customHeaders?.appName || 'Write Your Thoughts'
          }
        })
      case 'mistral':
        return new OpenAICompatibleProvider({
          ...enhancedSettings,
          baseUrl: 'https://api.mistral.ai/v1'
        })
      case 'together':
        return new OpenAICompatibleProvider({
          ...enhancedSettings,
          baseUrl: 'https://api.together.xyz/v1'
        })
      case 'xai':
        return new OpenAICompatibleProvider({
          ...enhancedSettings,
          baseUrl: 'https://api.x.ai/v1'
        })
      case 'ollama':
        return new OpenAICompatibleProvider({
          ...enhancedSettings,
          baseUrl: settings.baseUrl || 'http://localhost:11434/v1' // Ollama recently added OpenAI compat layer
        })
      case 'lmstudio':
        return new OpenAICompatibleProvider({
          ...enhancedSettings,
          baseUrl: settings.baseUrl || 'http://localhost:1234/v1'
        })
      case 'custom':
        if (!settings.baseUrl) throw new Error('Base URL is required for Custom provider')
        return new OpenAICompatibleProvider(enhancedSettings)
      default:
        throw new Error(`Unsupported AI provider: ${providerId}`)
    }
  }
}
