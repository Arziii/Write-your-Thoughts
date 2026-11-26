const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

export function isLoopbackAIUrl(value?: string): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      loopbackHosts.has(url.hostname) && !url.username && !url.password && !url.search && !url.hash
  } catch {
    return false
  }
}

export interface LocalAIRequest {
  baseUrl: string
  headers: Record<string, string>
  body?: string
  timeout: number
  requestId?: string
}

export interface LocalAIResponse {
  status: number
  body: string
}
