type Key = 'VITE_API_URL' | 'VITE_COMPANY_URL' | 'VITE_CUSTOMER_URL'

function read(key: Key, devFallback: string): string {
  const v = import.meta.env[key] as string | undefined
  if (v) return v.replace(/\/+$/, '')
  if (import.meta.env.DEV) return devFallback
  throw new Error(`Brak ${key} w konfiguracji builda`)
}

export const API_URL = read('VITE_API_URL', 'http://localhost:8000')
export const COMPANY_URL = read('VITE_COMPANY_URL', 'http://localhost:5173')
export const CUSTOMER_URL = read('VITE_CUSTOMER_URL', 'http://localhost:5174')