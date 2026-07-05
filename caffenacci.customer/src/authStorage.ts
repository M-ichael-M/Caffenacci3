export interface ClientAuthState {
  token: string
  user_id: string
  nick: string
  full_name: string
}

const STORAGE_KEYS = {
  token:     'caffenacci_client_token',
  user_id:   'caffenacci_client_user_id',
  nick:      'caffenacci_client_nick',
  full_name: 'caffenacci_client_full_name',
} as const

export function saveClientAuth(data: ClientAuthState) {
  localStorage.setItem(STORAGE_KEYS.token,     data.token)
  localStorage.setItem(STORAGE_KEYS.user_id,   data.user_id)
  localStorage.setItem(STORAGE_KEYS.nick,      data.nick)
  localStorage.setItem(STORAGE_KEYS.full_name, data.full_name)
}

export function clearClientAuth() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
}

export function loadClientAuth(): ClientAuthState | null {
  const token     = localStorage.getItem(STORAGE_KEYS.token)
  const user_id   = localStorage.getItem(STORAGE_KEYS.user_id)
  const nick      = localStorage.getItem(STORAGE_KEYS.nick)
  const full_name = localStorage.getItem(STORAGE_KEYS.full_name)
  if (token && user_id && nick && full_name) {
    return { token, user_id, nick, full_name }
  }
  return null
}
