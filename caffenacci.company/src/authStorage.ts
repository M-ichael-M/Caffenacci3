export interface AuthState {
  token: string
  cafe_id: string
  cafe_name: string
  owner_name: string
}

const STORAGE_KEYS = {
  token: 'caffenacci_token',
  cafe_id: 'caffenacci_cafe_id',
  cafe_name: 'caffenacci_cafe_name',
  owner_name: 'caffenacci_owner_name',
} as const

export function saveAuth(data: AuthState) {
  localStorage.setItem(STORAGE_KEYS.token, data.token)
  localStorage.setItem(STORAGE_KEYS.cafe_id, data.cafe_id)
  localStorage.setItem(STORAGE_KEYS.cafe_name, data.cafe_name)
  localStorage.setItem(STORAGE_KEYS.owner_name, data.owner_name)
}

export function clearAuth() {
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
}

export function loadAuth(): AuthState | null {
  const token = localStorage.getItem(STORAGE_KEYS.token)
  const cafe_id = localStorage.getItem(STORAGE_KEYS.cafe_id)
  const cafe_name = localStorage.getItem(STORAGE_KEYS.cafe_name)
  const owner_name = localStorage.getItem(STORAGE_KEYS.owner_name)
  return token && cafe_id && cafe_name && owner_name
    ? { token, cafe_id, cafe_name, owner_name }
    : null
}
