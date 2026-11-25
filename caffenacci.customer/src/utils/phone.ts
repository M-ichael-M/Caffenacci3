import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/min'

export interface CountryOption { code: string; name: string; dial: string }

export function dialCode(code: string): string {
  try { return getCountryCallingCode(code as CountryCode) } catch { return '' }
}

const cache = new Map<string, CountryOption[]>()

/** Lista krajów z nazwami w języku `locale`, posortowana alfabetycznie. */
export function countryOptions(locale: string): CountryOption[] {
  const hit = cache.get(locale)
  if (hit) return hit
  let names: Intl.DisplayNames | null = null
  try { names = new Intl.DisplayNames([locale], { type: 'region' }) } catch { /* fallback: kod ISO */ }
  let collator: Intl.Collator
  try { collator = new Intl.Collator(locale) } catch { collator = new Intl.Collator('en') }
  const list = getCountries().map(code => {
    let name: string = code
    try { name = names?.of(code) ?? code } catch { /* ignore */ }
    return { code, name, dial: getCountryCallingCode(code) }
  }).sort((a, b) => collator.compare(a.name, b.name))
  cache.set(locale, list)
  return list
}

/** Domyślny kraj: strefa czasowa → region języka przeglądarki → PL. */
export function detectRegion(): string {
  const valid = (r?: string) => (r && (getCountries() as string[]).includes(r) ? r : null)
  try {
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Europe/Warsaw') return 'PL'
  } catch { /* ignore */ }
  try {
    const loc = new Intl.Locale(navigator.language)
    const r = valid(loc.region?.toUpperCase()) ?? valid(loc.maximize().region?.toUpperCase())
    if (r) return r
  } catch { /* ignore */ }
  return 'PL'
}

/** Same cyfry krajowe + kraj → E.164 ('+48123456789') albo null, gdy numer jest niemożliwy. */
export function buildPhone(country: string, national: string): string | null {
  const digits = national.replace(/\D/g, '')
  if (!digits) return null
  const p = parsePhoneNumberFromString(digits, country as CountryCode)
  return p && p.isPossible() ? p.number : null
}

/** Wklejony numer z '+' → kraj + numer krajowy. */
export function parseInternational(raw: string): { country: string; national: string } | null {
  const p = parsePhoneNumberFromString(raw)
  return p?.country ? { country: p.country, national: p.nationalNumber } : null
}