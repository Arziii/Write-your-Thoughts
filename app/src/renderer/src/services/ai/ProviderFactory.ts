import { AIProvider, ProviderSettings } from '../../types'
import { IAIProvider } from './BaseProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { GeminiProvider } from './GeminiProvider'
import { ClaudeProvider } from './ClaudeProvider'
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider'
import { isLocalAIProvider } from './configuration'
import { isLoopbackAIUrl } from '../../../../shared/localAI'

export class ProviderFactory {
  static create(providerId: AIProvider, settings: ProviderSettings): IAIProvider {
    const local = isLocalAIProvider(providerId, settings.baseUrl)
    if (local && settings.baseUrl && !isLoopbackAIUrl(settings.baseUrl)) {
      throw new Error('Enter an address on this device for Local AI, or choose Custom for a remote server.')
    }
    if (!local && typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('You’re offline. Select Ollama or LM Studio in Settings to keep using AI.')
    }
    switch (providerId) {
      case 'openai':
        return new OpenAIProvider(settings)
      case 'gemini':
        return new GeminiProvider(settings)
      case 'claude':
        return new ClaudeProvider(settings)
      case 'groq':
        return new OpenAICompatibleProvider(providerId, {
          ...settings,
          baseUrl: 'https://api.groq.com/openai/v1'
        })
      case 'openrouter':
        return new OpenAICompatibleProvider(providerId, {
          ...settings,
          baseUrl: 'https://openrouter.ai/api/v1',
          customHeaders: {
            'HTTP-Referer': settings.customHeaders?.referer || window.location.href,
            'X-Title': settings.customHeaders?.appName || 'Write Your Thoughts'
          }
        })
      case 'mistral':
        return new OpenAICompatibleProvider(providerId, {
          ...settings,
          baseUrl: 'https://api.mistral.ai/v1'
        })
      case 'together':
        return new OpenAICompatibleProvider(providerId, {
          ...settings,
          baseUrl: 'https://api.together.xyz/v1'
        })
      case 'xai':
        return new OpenAICompatibleProvider(providerId, {
          ...settings,
          baseUrl: 'https://api.x.ai/v1'
        })
      case 'ollama':
        return new OpenAICompatibleProvider(providerId, {
          ...settings,
          baseUrl: settings.baseUrl || 'http://localhost:11434/v1'
        })
      case 'lmstudio':
        return new OpenAICompatibleProvider(providerId, {
          ...settings,
          baseUrl: settings.baseUrl || 'http://localhost:1234/v1'
        })
      case 'custom':
        if (!settings.baseUrl) throw new Error('Base URL is required for Custom provider')
        return new OpenAICompatibleProvider(providerId, settings)
      default:
        throw new Error(`Unsupported AI provider: ${providerId}`)
    }
  }
}
