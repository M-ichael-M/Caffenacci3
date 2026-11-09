import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_LANGUAGE, SystemI18nProvider, useI18n } from './I18nProvider'
import { loadSystem } from './system'
import type { LanguageInfo } from './localeFormat'

export type SiteLang = 'pl' | 'en'
const STORAGE_KEY = 'caffenacci_site_lang'

export const SITE_LANGUAGES: Record<SiteLang, LanguageInfo> = {
  pl: DEFAULT_LANGUAGE,
  en: { code: 'en', name_en: 'English', native_name: 'English', dir: 'ltr', locale: 'en-GB', collator_locale: 'en' },
}

function readSaved(): SiteLang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'pl' || v === 'en' ? v : null
  } catch { return null }
}

/** Zapisany wybór → język przeglądarki (pl → pl, cokolwiek innego → en). */
export function detectSiteLanguage(): SiteLang {
  const saved = readSaved()
  if (saved) return saved
  const first = (navigator.languages && navigator.languages[0]) || navigator.language || ''
  return /^pl(-|$)/i.test(first) ? 'pl' : 'en'
}

interface Ctx { lang: SiteLang; setLang: (l: SiteLang) => void }
const SiteLangContext = createContext<Ctx | null>(null)

export function useSiteLanguage(): Ctx {
  const c = useContext(SiteLangContext)
  if (!c) throw new Error('useSiteLanguage poza providerem')
  return c
}

const CAFE_ROUTE = /^\/(kawiarnia|cafe|preview)\//

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<SiteLang>(detectSiteLanguage)

  const setLang = useCallback((l: SiteLang) => {
    // Wczytaj słownik przed zmianą, żeby uniknąć migania.
    loadSystem(SITE_LANGUAGES[l].code).finally(() => {
      setLangState(l)
      try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
    })
  }, [])

  // Strony kawiarni same zarządzają <html lang> (CafeI18nProvider).
  useEffect(() => {
    if (CAFE_ROUTE.test(window.location.pathname)) return
    document.documentElement.lang = lang
    document.documentElement.dir = 'ltr'
  }, [lang])

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang])

  return (
    <SiteLangContext.Provider value={value}>
      <SystemI18nProvider language={SITE_LANGUAGES[lang]}>{children}</SystemI18nProvider>
    </SiteLangContext.Provider>
  )
}

export function LanguageToggle({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const { lang, setLang } = useSiteLanguage()
  const { t } = useI18n()
  return (
    <div className={`lang-toggle lang-toggle--${variant}`} role="group" aria-label={t('site_lang.aria')}>
      {(['pl', 'en'] as SiteLang[]).map(l => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          className={`lang-toggle__btn${lang === l ? ' lang-toggle__btn--on' : ''}`}
          onClick={() => setLang(l)}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
