import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { API_URL } from '../config'

interface Value { timeZone: string; currency: string; loaded: boolean }
const Ctx = createContext<Value>({ timeZone: 'Europe/Warsaw', currency: 'PLN', loaded: false })
export const useCafeSettings = () => useContext(Ctx)

export function CafeSettingsProvider({ token, children }: { token: string; children: ReactNode }) {
  const [v, setV] = useState<Value>({ timeZone: 'Europe/Warsaw', currency: 'PLN', loaded: false })

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/i18n/settings`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const d = await res.json()
        setV({ timeZone: d.settings.time_zone, currency: d.settings.currency, loaded: true })
      }
    } catch { /* zostaje poprzednia wartość */ }
  }, [token])

  useEffect(() => { load() }, [load])
  useEffect(() => {                                    // LanguagesCard wysyła to po zapisie
    window.addEventListener('caffenacci:profile-saved', load)
    return () => window.removeEventListener('caffenacci:profile-saved', load)
  }, [load])

  return <Ctx.Provider value={v}>{children}</Ctx.Provider>
}