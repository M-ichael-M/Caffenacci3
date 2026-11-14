/** Strefa czasowa przeglądarki (IANA) albo pusty tekst. */
export function browserTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { return '' }
}

/** Region z JAWNEGO kodu języka (km-KH → KH). Samo „en” nie daje regionu — nie zgadujemy. */
function browserRegion(): string | null {
  if (browserTimeZone() === 'Europe/Warsaw') return 'PL'
  try { return new Intl.Locale(navigator.language).region?.toUpperCase() ?? null } catch { return null }
}

/** Polska nazwa kraju (taka sama konwencja jak dotąd: „Polska”, „Kambodża”) albo pusty tekst. */
export function detectCountryName(): string {
  const code = browserRegion()
  if (!code) return ''
  try { return new Intl.DisplayNames(['pl'], { type: 'region' }).of(code) ?? '' } catch { return '' }
}