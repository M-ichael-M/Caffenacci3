export interface LanguageInfo {
  code: string; name_en: string; native_name: string
  dir: 'ltr' | 'rtl'; locale: string; collator_locale: string
}
export interface LocaleFormat { locale: string; currency: string; timeZone: string }
export type Texts = Record<string, string>

export const normalizeSource = (s: string) => s.normalize('NFC').replace(/\r\n/g, '\n').trim()

export function translateText<T extends string | null | undefined>(texts: Texts | null | undefined, source: T): T {
  if (!texts || !source) return source
  return (texts[normalizeSource(source)] ?? source) as T
}

export function applyDirection(l: { locale: string; dir: 'ltr' | 'rtl' }) {
  const el = document.documentElement
  el.lang = l.locale
  el.dir = l.dir
}

export function formatCurrency(v: number, fmt: LocaleFormat, currency: string = fmt.currency) {
  return formatMoney(v, fmt.locale, currency)
}
export function formatNumber(v: number, fmt: LocaleFormat, o?: Intl.NumberFormatOptions) {
  try { return new Intl.NumberFormat(fmt.locale, o).format(v) } catch { return String(v) }
}
/** "YYYY-MM-DD" (data kalendarzowa — bez strefy czasowej). */
export function formatDate(ymd: string, fmt: LocaleFormat,
  o: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Intl.DateTimeFormat(fmt.locale, { ...o, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d, 12)))
}
/** created_at z backendu = UTC bez sufiksu Z. */
export function formatDateTime(iso: string, fmt: LocaleFormat,
  o: Intl.DateTimeFormatOptions = { dateStyle: 'long', timeStyle: 'short' }) {
  const s = /([zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : iso + 'Z'
  return new Intl.DateTimeFormat(fmt.locale, { ...o, timeZone: fmt.timeZone }).format(new Date(s))
}
/** 0 = poniedziałek (jak w backendzie). 2024-01-01 to poniedziałek. */
export function weekdayName(dow: number, fmt: LocaleFormat, style: 'long' | 'short' = 'long') {
  const s = new Intl.DateTimeFormat(fmt.locale, { weekday: style, timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, 0, 1 + dow, 12)))
  return s.charAt(0).toLocaleUpperCase(fmt.locale) + s.slice(1)
}
export function makeCollator(collatorLocale: string) {
  try { return new Intl.Collator(collatorLocale, { sensitivity: 'base', numeric: true }) }
  catch { return new Intl.Collator('en') }
}
export function sortLocalized<T>(arr: readonly T[], c: Intl.Collator, key: (x: T) => string = x => String(x)) {
  return arr.slice().sort((a, b) => c.compare(key(a), key(b)))
}
import { formatMoney } from '../utils/currency'

