export interface LocaleFormat {
  locale: string            // tag BCP-47 (daty, liczby, waluty)
  dir: 'ltr' | 'rtl'
  collator_locale: string   // sortowanie
  currency: string          // ISO 4217 — waluta cen kawiarni
  time_zone: string         // IANA — strefa kawiarni
}

/** RTL: ustaw lang i dir na <html> (albo na kontenerze strony). */
export function applyDirection(f: Pick<LocaleFormat, 'locale' | 'dir'>, el: HTMLElement = document.documentElement) {
  el.lang = f.locale
  el.dir = f.dir
}

export function formatNumber(value: number, f: LocaleFormat, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(f.locale, options).format(value)
}

/** Ceny w menu są zapisane jako liczby — waluta pochodzi z ustawień kawiarni. */
export function formatCurrency(value: number, f: LocaleFormat): string {
  return formatMoney(value, f.locale, f.currency)
}

/** Data bez godziny ("YYYY-MM-DD", jak w rezerwacjach/zamówieniach) — bez przesunięć stref. */
export function formatDate(isoDate: string, f: LocaleFormat, options: Intl.DateTimeFormatOptions = { dateStyle: 'long' }): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Intl.DateTimeFormat(f.locale, { ...options, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)))
}

/** created_at z API to UTC bez sufiksu 'Z' — dopisujemy go i pokazujemy w strefie kawiarni. */
export function formatDateTime(iso: string, f: LocaleFormat, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  const utc = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`
  return new Intl.DateTimeFormat(f.locale, { ...options, timeZone: f.time_zone }).format(new Date(utc))
}

export function makeCollator(collatorLocale: string): Intl.Collator {
  return new Intl.Collator(collatorLocale, { numeric: true, sensitivity: 'base' })
}

export function sortLocalized<T>(items: T[], key: (x: T) => string, collatorLocale: string): T[] {
  const c = makeCollator(collatorLocale)
  return items.slice().sort((a, b) => c.compare(key(a), key(b)))
}

/** Ta sama normalizacja co w backendzie (normalize_text). */
export function normalizeText(s: string): string {
  return s.replace(/\r\n?/g, '\n').normalize('NFC').trim()
}

/** Tłumaczenie tekstu specyficznego dla kawiarni; brak wpisu → oryginał. */
export function translateText(texts: Record<string, string> | null, source: string | null | undefined): string {
  if (!source) return ''
  if (!texts) return source
  return texts[normalizeText(source)] ?? source
}
import { formatMoney } from './currency'

