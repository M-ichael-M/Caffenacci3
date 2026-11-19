// Lustro backend/app/core/seo_i18n.py (home_path / city_path). Zmieniasz tu → zmień tam.

declare global {
  interface Window {
    __LISTING__?: { city: string; country: string; badge: string | null }
    __HOME__?: { cities: { name: string; slug: string; count: number }[] }
  }
}

/** pl → polskie ścieżki; każdy inny język → angielskie. */
const isPl = (code: string) => code === 'pl'

export const homePath = (code: string) => (isPl(code) ? '/' : '/en/')

export const cityPath = (code: string, citySlug: string) =>
  isPl(code) ? `/kawiarnie/${encodeURIComponent(citySlug)}` : `/en/cafes/${encodeURIComponent(citySlug)}`

export const cafePath = (slug: string, lang?: string | null) =>
  `/kawiarnia/${encodeURIComponent(slug)}${lang ? `/${encodeURIComponent(lang)}` : ''}`

/** Język serwisu wynikający z URL-a (strona główna / listingi); null = URL tego nie rozstrzyga. */
export function siteLangFromPath(path = window.location.pathname): 'pl' | 'en' | null {
  if (/^\/en(\/|$)/.test(path)) return 'en'
  if (path === '/' || /^\/kawiarnie\//.test(path)) return 'pl'
  return null
}

/** Odpowiednik bieżącej ścieżki w drugim języku (null = ścieżka nie ma wersji językowej). */
export function sitePathFor(path: string, lang: 'pl' | 'en'): string | null {
  let m: RegExpMatchArray | null
  if (path === '/' || /^\/en\/?$/.test(path)) return lang === 'pl' ? '/' : '/en/'
  if ((m = path.match(/^\/kawiarnie\/(.+)$/))) return lang === 'pl' ? path : `/en/cafes/${m[1]}`
  if ((m = path.match(/^\/en\/cafes\/(.+)$/))) return lang === 'pl' ? `/kawiarnie/${m[1]}` : path
  return null
}

/** Język dodatkowy kawiarni z URL-a: /kawiarnia/{slug}/{lang} */
export function langFromCafePath(path = window.location.pathname): string | null {
  const m = path.match(/^\/(?:kawiarnia|cafe)\/[^/]+\/([^/]+)/)
  return m ? decodeURIComponent(m[1]) : null
}