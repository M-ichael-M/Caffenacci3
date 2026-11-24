import { useEffect } from 'react'
import { imageUrl } from '../components/ResponsiveImage'

export interface CafeSeoData {
  cafe_name: string
  logo_url: string | null
}

// JSON-LD, canonical, OG itd. generuje backend (routers/seo.py). Tu zostaje tylko to,
// co ma sens po stronie klienta: og:site_name i favicon.
export function useCafeHead(d: CafeSeoData, enabled: boolean) {
  const { cafe_name, logo_url } = d

  useEffect(() => {
    if (!enabled) return
    const undo: (() => void)[] = []

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
  }, [enabled, cafe_name, logo_url])
}
