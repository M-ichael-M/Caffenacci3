import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'
import { formatMoney } from '../utils/currency'

interface Value { timeZone: string; currency: string; regionConfirmed: boolean; loaded: boolean }
const Ctx = createContext<Value>({ timeZone: 'Europe/Warsaw', currency: 'PLN', regionConfirmed: true, loaded: false })
export const useCafeSettings = () => useContext(Ctx)

export function CafeSettingsProvider({ token, children }: { token: string; children: ReactNode }) {
  const [v, setV] = useState<Value>({ timeZone: 'Europe/Warsaw', currency: 'PLN', regionConfirmed: true, loaded: false })

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/i18n/settings`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const d = await res.json()
        setV({
          timeZone: d.settings.time_zone, currency: d.settings.currency,
          regionConfirmed: d.settings.region_confirmed !== false, loaded: true,
        })
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

/** money(n) → w walucie kawiarni; money(n, 'JPY') → w podanej walucie. */
export function useMoney() {
  const { currency } = useCafeSettings()
  const { locale } = useI18n()
  return useCallback((n: number, cur?: string) => formatMoney(n, locale, cur ?? currency), [locale, currency])
}
