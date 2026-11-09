import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { API_URL } from '../config'
import { useI18n } from '../i18n/I18nProvider'
import type { TFunction } from '../i18n/system'
import './cafesMap.css'

interface MapCafe {
  cafe_id: string; slug: string; cafe_name: string; latitude: number; longitude: number
  is_open_now: boolean | null; open_time: string | null; close_time: string | null; closed_today: boolean
}
interface PinProps { slug: string; name: string; status: string; open: number }
interface Props { query: string; country: string }

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'
const SOURCE = 'cafes'
const CLUSTER_MAX_ZOOM = 16

function statusOf(c: MapCafe, t: TFunction): { text: string; open: number } {
  if (c.is_open_now === true) return { text: c.close_time ? t('map.open_until', { time: c.close_time }) : t('map.open_now'), open: 1 }
  if (c.closed_today) return { text: t('map.closed_today'), open: 0 }
  if (c.is_open_now === false) return { text: c.open_time && c.close_time ? t('map.closed_hours', { open: c.open_time, close: c.close_time }) : t('map.closed'), open: 0 }
  return { text: t('map.no_hours'), open: -1 }
}

function toGeoJSON(cafes: MapCafe[], t: TFunction): GeoJSON.FeatureCollection<GeoJSON.Point, PinProps> {
  return { type: 'FeatureCollection', features: cafes.map(c => {
    const s = statusOf(c, t)
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
      properties: { slug: c.slug, name: c.cafe_name, status: s.text, open: s.open } }
  }) }
}

function h(tag: string, className?: string, text?: string): HTMLElement {
  const el = document.createElement(tag)
  if (className) el.className = className
  if (text !== undefined) el.textContent = text
  return el
}
function cafeCard(p: PinProps, t: TFunction): HTMLElement {
  const card = h('div', 'cmap-card')
  card.appendChild(h('div', 'cmap-card__name', p.name))
  const cls = p.open === 1 ? ' cmap-card__status--open' : p.open === 0 ? ' cmap-card__status--closed' : ''
  card.appendChild(h('div', `cmap-card__status${cls}`, p.status))
  const link = h('a', 'cmap-card__link', t('map.go')) as HTMLAnchorElement
  link.href = `/kawiarnia/${encodeURIComponent(p.slug)}`
  card.appendChild(link)
  return card
}
function cafeList(items: PinProps[], t: TFunction): HTMLElement {
  const wrap = h('div', 'cmap-list')
  wrap.appendChild(h('div', 'cmap-list__title', t('map.list_title', { n: items.length })))
  items.forEach(p => { const row = h('div', 'cmap-list__row'); row.appendChild(cafeCard(p, t)); wrap.appendChild(row) })
  return wrap
}

export default function CafesMap({ query, country }: Props) {
  const { t, language } = useI18n()
  const tRef = useRef(t)
  tRef.current = t

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [cafes, setCafes] = useState<MapCafe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Mapa budowana od nowa przy zmianie języka (etykiety kontrolek są ustawiane przy tworzeniu).
  useEffect(() => {
    if (!containerRef.current) return
    setMapReady(false)
    const tt = tRef.current
    const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#A9722F'
    const map = new maplibregl.Map({ container: containerRef.current, style: MAP_STYLE, center: [19.4, 52.1], zoom: 5,
      maxZoom: 18, locale: { 'NavigationControl.ZoomIn': tt('map.c_zoom_in'), 'NavigationControl.ZoomOut': tt('map.c_zoom_out'),
        'NavigationControl.ResetBearing': tt('map.c_reset'), 'GeolocateControl.FindMyLocation': tt('map.c_locate'),
        'GeolocateControl.LocationNotAvailable': tt('map.c_unavailable') } })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: false },
      fitBoundsOptions: { maxZoom: 14 }, trackUserLocation: false }), 'top-right')
    map.on('load', () => {
      map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 50, clusterMaxZoom: CLUSTER_MAX_ZOOM })
      map.addLayer({ id: 'clusters', type: 'circle', source: SOURCE, filter: ['has', 'point_count'], paint: {
        'circle-color': gold, 'circle-radius': ['step', ['get', 'point_count'], 18, 10, 22, 50, 28], 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } })
      map.addLayer({ id: 'cluster-count', type: 'symbol', source: SOURCE, filter: ['has', 'point_count'], layout: {
        'text-field': ['concat', ['to-string', ['get', 'point_count']], '+'], 'text-font': ['Noto Sans Bold'], 'text-size': 13, 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff' } })
      map.addLayer({ id: 'pins', type: 'circle', source: SOURCE, filter: ['!', ['has', 'point_count']], paint: {
        'circle-color': gold, 'circle-radius': 9, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' } })
      const openPopup = (lngLat: [number, number], content: HTMLElement) => {
        popupRef.current?.remove()
        popupRef.current = new maplibregl.Popup({ className: 'cmap-popup', offset: 14, maxWidth: '280px' }).setLngLat(lngLat).setDOMContent(content).addTo(map)
      }
      map.on('click', 'clusters', async e => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
        if (!f) return
        const clusterId = f.properties?.cluster_id as number
        const center = (f.geometry as GeoJSON.Point).coordinates as [number, number]
        const src = map.getSource(SOURCE) as maplibregl.GeoJSONSource
        try {
          const zoom = await src.getClusterExpansionZoom(clusterId)
          if (zoom <= CLUSTER_MAX_ZOOM) { map.easeTo({ center, zoom: zoom + 0.3 }); return }
          const leaves = await src.getClusterLeaves(clusterId, 100, 0)
          const [x0, y0] = (leaves[0].geometry as GeoJSON.Point).coordinates
          if (leaves.every(l => { const [x, y] = (l.geometry as GeoJSON.Point).coordinates; return x === x0 && y === y0 }))
            openPopup(center, cafeList(leaves.map(l => l.properties as PinProps), tRef.current))
          else map.easeTo({ center, zoom: CLUSTER_MAX_ZOOM + 1.5 })
        } catch { /* ignoruj błędy klastra */ }
      })
      map.on('click', 'pins', e => {
        const f = e.features?.[0]
        if (f) openPopup((f.geometry as GeoJSON.Point).coordinates as [number, number], cafeCard(f.properties as unknown as PinProps, tRef.current))
      })
      for (const layer of ['clusters', 'pins']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }
      setMapReady(true)
    })
    return () => { popupRef.current?.remove(); map.remove(); mapRef.current = null }
  }, [language.code])

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const p = new URLSearchParams()
        if (query.trim()) p.set('q', query.trim())
        if (country) p.set('country', country)
        const qs = p.toString()
        const res = await fetch(`${API_URL}/cafes/map${qs ? `?${qs}` : ''}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error()
        const data = await res.json()
        setCafes(data.cafes ?? []); setError(false)
      } catch (e) { if ((e as Error).name !== 'AbortError') setError(true) }
      finally { if (!ctrl.signal.aborted) setLoading(false) }
    }, 350)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [query, country])

  // Dane (teksty statusów zależą od języka)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    popupRef.current?.remove()
    ;(map.getSource(SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(toGeoJSON(cafes, t))
  }, [cafes, mapReady, t])

  // Kadrowanie tylko przy zmianie listy kawiarni
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !cafes.length) return
    if (cafes.length === 1) { map.flyTo({ center: [cafes[0].longitude, cafes[0].latitude], zoom: 14 }); return }
    const bounds = new maplibregl.LngLatBounds()
    cafes.forEach(c => bounds.extend([c.longitude, c.latitude]))
    map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 600 })
  }, [cafes, mapReady])

  return <div className="cmap-wrap">
    <div ref={containerRef} className="cmap" />
    {loading && <div className="cmap-overlay">{t('map.loading')}</div>}
    {!loading && error && <div className="cmap-overlay cmap-overlay--error">{t('map.err')}</div>}
    {!loading && !error && cafes.length === 0 && <div className="cmap-overlay">{t('map.empty')}</div>}
  </div>
}
