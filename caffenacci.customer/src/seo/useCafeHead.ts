import { useEffect } from 'react'
import { imageUrl } from '../components/ResponsiveImage'
import { cafePath } from '../utils/sitePaths'

export interface CafeSeoData {
  cafe_name: string
  slug?: string | null
  logo_url: string | null
  country: string
  city: string
  street: string
  building_number: string
  postal_code: string
  contact_phone: string | null
  contact_email: string | null
  latitude: number | null
  longitude: number | null
  weekly_hours: { day_of_week: number; open_time: string | null; close_time: string | null }[]
  reviews_average: number
  reviews_count: number
  google_maps_url?: string | null
  price_range?: string | null
  serves_cuisine?: string[] | null
  payment_methods?: string[] | null
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function buildCafeJsonLd(d: CafeSeoData, fallbackMapsUrl: string | null) {
  const logo = d.logo_url ? new URL(imageUrl(d.logo_url, 256), window.location.origin).href : undefined
  const hours = d.weekly_hours
    .filter(h => h.open_time && h.close_time && DAYS[h.day_of_week])
    .map(h => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: DAYS[h.day_of_week],
      opens: h.open_time,
      closes: h.close_time,
    }))

  return {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: d.cafe_name,
    url: d.slug ? new URL(cafePath(d.slug), window.location.origin).href : window.location.href,
    image: logo,
    telephone: d.contact_phone || undefined,
    email: d.contact_email || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: [d.street, d.building_number].filter(Boolean).join(' ') || undefined,
      postalCode: d.postal_code || undefined,
      addressLocality: d.city || undefined,
      addressCountry: d.country || undefined,
    },
    geo: d.latitude != null && d.longitude != null
      ? { '@type': 'GeoCoordinates', latitude: d.latitude, longitude: d.longitude }
      : undefined,
    hasMap: d.google_maps_url || fallbackMapsUrl || undefined,
    sameAs: d.google_maps_url ? [d.google_maps_url] : undefined,
    priceRange: d.price_range || undefined,
    servesCuisine: d.serves_cuisine?.length ? d.serves_cuisine : undefined,
    paymentAccepted: d.payment_methods?.length ? d.payment_methods.join(', ') : undefined,
    openingHoursSpecification: hours.length ? hours : undefined,
    aggregateRating: d.reviews_count > 0
      ? { '@type': 'AggregateRating', ratingValue: d.reviews_average, reviewCount: d.reviews_count }
      : undefined,
  }
}

export function useCafeHead(d: CafeSeoData, enabled: boolean, fallbackMapsUrl: string | null) {
  useEffect(() => {
    if (!enabled) return
    const undo: (() => void)[] = []

    if (!document.querySelector('meta[property="og:site_name"]')) {
      const meta = document.createElement('meta')
      meta.setAttribute('property', 'og:site_name')
      meta.content = d.cafe_name
      document.head.appendChild(meta)
      undo.push(() => meta.remove())
    }

    if (d.logo_url) {
      const href = new URL(imageUrl(d.logo_url, 256), window.location.origin).href
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

    if (!document.getElementById('ld-cafe')) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = 'ld-cafe'
      script.text = JSON.stringify(buildCafeJsonLd(d, fallbackMapsUrl)).replace(/</g, '\\u003c')
      document.head.appendChild(script)
      undo.push(() => script.remove())
    }

    return () => undo.forEach(cleanup => cleanup())
  }, [enabled, d, fallbackMapsUrl])
}
