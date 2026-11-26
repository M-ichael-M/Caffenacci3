import { useEffect } from 'react'
import { imageUrl } from '../components/ResponsiveImage'

export interface CafeSeoData {
  cafe_name: string
  city?: string
  logo_url: string | null
}

const TITLE_MAX = 70

function buildCafeTitle(name: string, city: string | undefined, lang: string): string {
  const isPl = lang === 'pl'
  if (!city) {
    return `${name} | Caffenacci`
  }
  const full = isPl
    ? `${name} – kawiarnia w ${city} | Menu, godziny, opinie`
    : `${name} – café in ${city} | Menu, hours, reviews`
  if (full.length <= TITLE_MAX) return full

  const short = isPl
    ? `${name} – kawiarnia w ${city} | Caffenacci`
    : `${name} – café in ${city} | Caffenacci`
  if (short.length <= TITLE_MAX) return short

  return `${name} – ${city}`
}

// JSON-LD, canonical, OG itd. generuje backend (routers/seo.py). Tu zostaje tylko to,
// co ma sens po stronie klienta: document.title, og:site_name i favicon.
export function useCafeHead(d: CafeSeoData, enabled: boolean, lang: string = 'pl') {
  const { cafe_name, city, logo_url } = d

  useEffect(() => {
    if (!enabled || !cafe_name) return
    const undo: (() => void)[] = []

    const prevTitle = document.title
    document.title = buildCafeTitle(cafe_name, city, lang)
    undo.push(() => {
      document.title = prevTitle
    })

    if (!document.querySelector('meta[property="og:site_name"]')) {
      const meta = document.createElement('meta')
      meta.setAttribute('property', 'og:site_name')
      meta.content = cafe_name
      document.head.appendChild(meta)
      undo.push(() => meta.remove())
    }

    if (logo_url) {
      const href = new URL(imageUrl(logo_url, 256), window.location.origin).href
      const icons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]'))
      const previous = icons.map(link => [link, link.getAttribute('href')] as const)
      if (!icons.some(link => link.dataset.cafe)) {
        icons.forEach(link => link.setAttribute('href', href))
        if (!icons.length) {
          const link = document.createElement('link')
          link.rel = 'icon'
          link.href = href
          link.dataset.cafe = '1'
          document.head.appendChild(link)
          undo.push(() => link.remove())
        }
        undo.push(() => previous.forEach(([link, oldHref]) => {
          if (oldHref !== null) link.setAttribute('href', oldHref)
          else link.removeAttribute('href')
        }))
      }
    }

    return () => undo.forEach(cleanup => cleanup())
  }, [enabled, cafe_name, city, logo_url, lang])
}
