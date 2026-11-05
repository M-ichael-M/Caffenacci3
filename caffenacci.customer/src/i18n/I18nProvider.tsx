import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { applyDirection, makeCollator, translateText, type LanguageInfo, type LocaleFormat, type Texts } from './localeFormat'
import { loadSystem, makeT, type SystemDicts, type TFunction } from './system'

export interface CafeI18nData {
  primary: LanguageInfo
  secondary: LanguageInfo | null
  translation_version: number | null
  currency: string
  time_zone: string
}
export const DEFAULT_LANGUAGE: LanguageInfo = {
  code: 'pl', name_en: 'Polish', native_name: 'Polski', dir: 'ltr', locale: 'pl-PL', collator_locale: 'pl',
}
export function normalizeI18n(raw?: Partial<CafeI18nData> | null): CafeI18nData {
  return {
    primary: raw?.primary ?? DEFAULT_LANGUAGE,
    secondary: raw?.secondary ?? null,
    translation_version: raw?.translation_version ?? null,
    currency: raw?.currency ?? 'PLN',
    time_zone: raw?.time_zone ?? 'Europe/Warsaw',
  }
}

type Which = 'primary' | 'secondary'
export type Tr = <T extends string | null | undefined>(s: T) => T

export interface LanguageSwitcherState {
  primary: LanguageInfo; secondary: LanguageInfo
  active: Which; busy: boolean; select: (w: Which) => void
}
interface Ctx {
  language: LanguageInfo; t: TFunction; tr: Tr; fmt: LocaleFormat
  collator: Intl.Collator; switcher: LanguageSwitcherState | null
}
const I18nContext = createContext<Ctx | null>(null)

export function useI18n(): Ctx {
  const c = useContext(I18nContext)
  if (!c) throw new Error('useI18n poza providerem')
  return c
}

const Spinner = () => <div className="session-check"><div className="loading-spinner" /></div>

function build(language: LanguageInfo, d: SystemDicts, currency: string, timeZone: string,
               texts: Texts | null, switcher: LanguageSwitcherState | null): Ctx {
  return {
    language,
    t: makeT(language.locale, language.dir, d),
    tr: (texts ? (s => translateText(texts, s)) : (s => s)) as Tr,
    fmt: { locale: language.locale, currency, timeZone },
    collator: makeCollator(language.collator_locale),
    switcher,
  }
}

// ── Napisy systemowe w stałym języku (konto gościa, logowanie poza stroną kawiarni) ──
export function SystemI18nProvider(
  { language, currency = 'PLN', timeZone = 'Europe/Warsaw', children }:
  { language: LanguageInfo; currency?: string; timeZone?: string; children: ReactNode },
) {
  const [d, setD] = useState<SystemDicts | null>(null)
  useEffect(() => { let off = false; loadSystem(language.code).then(x => { if (!off) setD(x) }); return () => { off = true } }, [language.code])
  const value = useMemo(() => (d ? build(language, d, currency, timeZone, null, null) : null), [d, language, currency, timeZone])
  if (!value) return <Spinner />
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// ── Strona kawiarni: primary + opcjonalnie secondary ──
const prefKey = (cafeKey: string) => `caffenacci_lang:${cafeKey}`
const readPref = (k: string) => { try { return localStorage.getItem(prefKey(k)) } catch { return null } }
const writePref = (k: string, v: string) => { try { localStorage.setItem(prefKey(k), v) } catch { /* ignore */ } }

export function CafeI18nProvider(
  { i18n, cafeKey, fetchTranslations, children }:
  { i18n: CafeI18nData; cafeKey: string; fetchTranslations: (lang: string) => Promise<Texts>; children: ReactNode },
) {
  const { primary, secondary } = i18n
  const secondaryCode = secondary?.code ?? null
  const version = i18n.translation_version
  const fetchRef = useRef(fetchTranslations); fetchRef.current = fetchTranslations
  const cache = useRef(new Map<string, Texts>())

  const [dicts, setDicts] = useState<Record<string, SystemDicts>>({})
  const [desired, setDesired] = useState<Which>(() =>
    secondaryCode && readPref(cafeKey) === secondaryCode ? 'secondary' : 'primary')
  const [active, setActive] = useState<Which>('primary')   // pierwszy render zawsze w primary
  const [texts, setTexts] = useState<Texts | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let off = false
    loadSystem(primary.code).then(d => { if (!off) setDicts(p => ({ ...p, [primary.code]: d })) })
    return () => { off = true }
  }, [primary.code])

  // Przełączenie na secondary jest atomowe: tłumaczenia + napisy systemowe gotowe → dopiero zmiana.
  useEffect(() => {
    if (!secondaryCode || desired === 'primary') { setActive('primary'); setTexts(null); setBusy(false); return }
    let off = false
    setBusy(true)
    const key = `${secondaryCode}:${version}`
    Promise.all([cache.current.get(key) ?? fetchRef.current(secondaryCode), loadSystem(secondaryCode)])
      .then(([tx, d]) => {
        if (off) return
        cache.current.set(key, tx)
        setDicts(p => ({ ...p, [secondaryCode]: d }))
        setTexts(tx); setActive('secondary')
      })
      .catch(() => { if (!off) setDesired('primary') })      // 404/sieć → cicho wróć do primary
      .finally(() => { if (!off) setBusy(false) })
    return () => { off = true }
  }, [desired, secondaryCode, version])

  const language = active === 'secondary' && secondary ? secondary : primary
  const d = dicts[language.code]

  useEffect(() => {
    const el = document.documentElement
    const prev = { lang: el.lang, dir: el.dir }
    applyDirection(language)
    return () => { el.lang = prev.lang; el.dir = prev.dir }
  }, [language])

  const switcher = useMemo<LanguageSwitcherState | null>(() => secondary ? {
    primary, secondary, active: desired, busy,
    select: (w: Which) => { setDesired(w); writePref(cafeKey, w === 'secondary' ? secondary.code : primary.code) },
  } : null, [primary, secondary, desired, busy, cafeKey])

  const value = useMemo(() => d ? build(language, d, i18n.currency, i18n.time_zone, texts, switcher) : null,
    [d, language, i18n.currency, i18n.time_zone, texts, switcher])

  if (!value) return <Spinner />
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}