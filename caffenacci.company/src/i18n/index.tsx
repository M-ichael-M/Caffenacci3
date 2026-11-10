import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { pl } from './pl'
import { en, enApiErrors, enApiPatterns } from './en'

export type Lang = 'pl' | 'en'
export const LANGS: Lang[] = ['pl', 'en']

const STORAGE_KEY = 'caffenacci_ui_lang'
const LOCALES: Record<Lang, string> = { pl: 'pl-PL', en: 'en-GB' }
const DICTS: Record<Lang, Record<string, string>> = { pl, en }

export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'pl' || stored === 'en') return stored
  } catch { /* brak dostępu do storage */ }
  const pref = navigator.languages?.[0] ?? navigator.language ?? ''
  return pref.toLowerCase().startsWith('pl') ? 'pl' : 'en'
}

type Params = Record<string, string | number>

interface I18nValue {
  lang: Lang
  /** tag BCP-47 do toLocaleDateString / Intl */
  locale: string
  setLang: (l: Lang) => void
  /** t('klucz', { name }) ; z { count } wybiera formę liczby: klucz_one/few/many/other */
  t: (key: string, params?: Params) => string
  /** Tłumaczy komunikat błędu z API (backend zwraca po polsku); nieznane zostawia bez zmian. */
  tApi: (detail: unknown, fallbackKey?: string) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  // <html lang> — to na tej podstawie Chrome decyduje, czy zaproponować tłumaczenie.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
    setLangState(l)
  }, [])

  const t = useCallback((key: string, params?: Params) => {
    const dict = DICTS[lang]
    let k = key
    if (params && typeof params.count === 'number') {
      const rule = new Intl.PluralRules(lang).select(params.count)
      if (dict[`${key}_${rule}`] !== undefined) k = `${key}_${rule}`
      else if (dict[`${key}_other`] !== undefined) k = `${key}_other`
    }
    const msg = dict[k] ?? pl[k as keyof typeof pl] ?? key
    return params ? msg.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`)) : msg
  }, [lang])

  const tApi = useCallback((detail: unknown, fallbackKey = 'common.genericError') => {
    if (typeof detail !== 'string' || !detail) return t(fallbackKey)
    if (lang === 'pl') return detail
    const exact = enApiErrors[detail]
    if (exact) return exact
    for (const [re, fn] of enApiPatterns) {
      const m = detail.match(re)
      if (m) return fn(m)
    }
    return detail
  }, [lang, t])

  const value = useMemo<I18nValue>(
    () => ({ lang, locale: LOCALES[lang], setLang, t, tApi }),
    [lang, setLang, t, tApi],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n musi być użyte wewnątrz <I18nProvider>')
  return ctx
}
