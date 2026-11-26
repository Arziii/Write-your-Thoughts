import { isLoopbackAIUrl } from '../../../../shared/localAI'
import type { AIProvider, ProviderSettings, Settings } from '../../types'

export function isLocalAIProvider(provider?: AIProvider, baseUrl?: string): boolean {
  return provider === 'ollama' || provider === 'lmstudio' ||
    (provider === 'custom' && isLoopbackAIUrl(baseUrl))
}

export function isOllamaCloudModel(model: string): boolean {
  return /(?:^|[:-])cloud(?:$|[:-])/i.test(model)
}

export function resolveAISettings(
  provider: AIProvider,
  legacyKey?: string,
  overrides?: Record<string, ProviderSettings>,
): ProviderSettings {
  const configured = overrides?.[provider]
  return {
    ...configured,
    apiKey: configured?.apiKey?.trim() ||
      (isLocalAIProvider(provider, configured?.baseUrl) ? undefined : legacyKey?.trim()),
  }
}

export function getAIConfigurationError(settings: Settings | null): string | undefined {
  if (!settings) return 'Open Settings to configure an AI provider.'
  const provider = settings.ai_provider || 'openai'
  const configured = settings.ai_settings?.[provider]
  if (isLocalAIProvider(provider, configured?.baseUrl)) return
  if (!navigator.onLine) return 'You’re offline. Select Ollama or LM Studio in Settings to keep using AI.'
  if (!configured?.apiKey?.trim() && !settings.ai_api_key?.trim()) {
    return 'Set an AI API key in Settings first.'
  }
}
