import { API_URL } from './config'

export const SESSION_EXPIRED_EVENT = 'caffenacci:session-expired'
export const SESSION_TOKEN_UPDATED_EVENT = 'caffenacci:session-token-updated'

interface Adapter {
  refreshPath: string
  load: () => { token: string } | null
  setToken: (token: string) => void
  clear: () => void
}

const REFRESH_WHEN_LEFT_MS = 20 * 60 * 1000
const CHECK_EVERY_MS = 5 * 60 * 1000

function tokenExpiry(token: string): number | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(base64)) as { exp?: unknown }
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

let installed = false

export function installSessionGuard(adapter: Adapter) {
  if (installed) return
  installed = true

  const nativeFetch = window.fetch.bind(window)
  let lastExpired = 0
  let refreshInFlight: Promise<void> | null = null

  const expire = () => {
    if (Date.now() - lastExpired < 2000) return
    lastExpired = Date.now()
    adapter.clear()
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }

  const isApiRequest = (target: string) => target === API_URL || target.startsWith(`${API_URL}/`)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
    if (!isApiRequest(target)) return nativeFetch(input, init)

    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value))
    if (!headers.has('Authorization')) return nativeFetch(input, init)

    const currentToken = adapter.load()?.token
    if (currentToken) headers.set('Authorization', `Bearer ${currentToken}`)
    else headers.delete('Authorization')

    const response = await nativeFetch(input, { ...init, headers })
    if (response.status === 401) expire()
    return response
  }

  const maybeRefresh = async () => {
    if (refreshInFlight) return refreshInFlight
    const stored = adapter.load()
    if (!stored) return
    const expiry = tokenExpiry(stored.token)
    if (!expiry) return
    const remaining = expiry - Date.now()
    if (remaining <= 0) {
      expire()
      return
    }
    if (remaining > REFRESH_WHEN_LEFT_MS) return

    refreshInFlight = (async () => {
      try {
        const response = await nativeFetch(`${API_URL}${adapter.refreshPath}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${stored.token}` },
        })
        if (response.ok) {
          const data = await response.json() as { access_token?: unknown }
          if (typeof data.access_token === 'string' && data.access_token) {
            adapter.setToken(data.access_token)
          }
        } else if (response.status === 401) {
          expire()
        }
      } catch {
        // Keep the session during temporary network failures; retry on next check.
      } finally {
        refreshInFlight = null
      }
    })()
    return refreshInFlight
  }

  window.setInterval(() => { void maybeRefresh() }, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void maybeRefresh()
  })
}
