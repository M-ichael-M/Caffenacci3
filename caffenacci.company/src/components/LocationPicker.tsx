import { useState, useRef, useEffect, useCallback } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ExternalLink, X } from 'lucide-react'

// Styl mapy: OpenFreeMap „Liberty" — darmowe na zawsze, bez limitów, bez
// klucza API, można używać komercyjnie (dane © OpenStreetMap contributors,
// atrybucję dorzuca automatycznie MapLibre). Alternatywa: „positron" —
// bardziej stonowany, szary styl, jeśli „liberty" jest zbyt kolorowe.
// https://openfreemap.org
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface Props {
  latitude:  number | null
  longitude: number | null
  onPositionChange: (lat: number, lng: number) => void

  locationVisible: boolean
  onLocationVisibleChange: (v: boolean) => void
  showMap: boolean
  onShowMapChange: (v: boolean) => void
  showGmapsLink: boolean
  onShowGmapsLinkChange: (v: boolean) => void
}

const DEFAULT_CENTER: [number, number] = [19.0, 52.0] // środek Polski (lng, lat)
const DEFAULT_ZOOM = 6
const PIN_ZOOM = 16

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--espresso)' : 'var(--border)',
        opacity: disabled ? 0.45 : 1,
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 20 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: checked ? 'var(--gold-soft)' : '#fff',
        transition: 'left 0.2s, background 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

export default function LocationPicker({
  latitude, longitude, onPositionChange,
  locationVisible, onLocationVisibleChange,
  showMap, onShowMapChange,
  showGmapsLink, onShowGmapsLinkChange,
}: Props) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)

  const hasPin = latitude !== null && longitude !== null

  // Ref na najnowszy callback, żeby nie przebudowywać mapy (i nie tracić
  // jej zoomu/pozycji) za każdym razem, gdy rodzic przekaże nową funkcję.
  const onPositionChangeRef = useRef(onPositionChange)
  onPositionChangeRef.current = onPositionChange

  // ── Inicjalizacja mapy (raz) ─────────────────────────────────────────

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: hasPin ? [longitude!, latitude!] : DEFAULT_CENTER,
      zoom: hasPin ? PIN_ZOOM : DEFAULT_ZOOM,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('click', e => {
      onPositionChangeRef.current(e.lngLat.lat, e.lngLat.lng)
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Marker: dodaj / przesuń / usuń w zależności od pinezki ──────────

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!hasPin) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ draggable: true, color: '#A9722F' })
        .setLngLat([longitude!, latitude!])
        .addTo(map)

      markerRef.current.on('dragend', () => {
        const pos = markerRef.current!.getLngLat()
        onPositionChangeRef.current(pos.lat, pos.lng)
      })
    } else {
      markerRef.current.setLngLat([longitude!, latitude!])
    }
  }, [hasPin, latitude, longitude])

  // ── Wyszukiwanie adresu przez Nominatim (OpenStreetMap) ────────────────

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,
        { headers: { 'Accept-Language': 'pl' } },
      )
      if (res.ok) {
        const data: NominatimResult[] = await res.json()
        setResults(data)
        setShowResults(true)
      }
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }, [])

  const handleQueryChange = (v: string) => {
    setQuery(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(v), 500)
  }

  const selectResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    onPositionChange(lat, lng)
    setQuery(r.display_name)
    setShowResults(false)
    mapRef.current?.flyTo({ center: [lng, lat], zoom: PIN_ZOOM })
  }

  const clearPin = () => {
    onPositionChange(NaN, NaN) // rodzic zamienia NaN na null — patrz ProfileTab
  }

  const gmapsUrl = hasPin
    ? `https://www.google.com/maps?q=${latitude},${longitude}`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Wyszukiwarka adresu */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="field__input"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="Wpisz adres, aby wyszukać na mapie (np. Marszałkowska 12, Warszawa)"
        />
        {searching && (
          <span style={{ position: 'absolute', right: '0.875rem', top: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            szukam…
          </span>
        )}
        {showResults && results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', marginTop: '0.25rem', overflow: 'hidden',
            boxShadow: 'var(--shadow-pop)',
          }}>
            {results.map(r => (
              <button
                key={r.place_id}
                type="button"
                onClick={() => selectResult(r)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '0.625rem 0.875rem', border: 'none', background: 'none',
                  fontSize: '0.8125rem', color: 'var(--text-dark)', cursor: 'pointer',
                  borderBottom: '1px solid var(--border-soft)', fontFamily: 'inherit',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="loc-map-container" ref={mapContainerRef} />

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Kliknij na mapie, aby postawić pinezkę, albo przeciągnij istniejącą. Możesz też wyszukać adres powyżej.
      </p>

      {/* Współrzędne + link + reset */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {hasPin ? (
          <>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-dark)', fontFamily: 'monospace' }}>
              {latitude!.toFixed(6)}, {longitude!.toFixed(6)}
            </span>
            {gmapsUrl && (
              <a href={gmapsUrl} target="_blank" rel="noreferrer" className="link" style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                Podgląd w Google Maps <ExternalLink size={13} />
              </a>
            )}
            <button type="button" className="me-remove-btn me-remove-item" onClick={clearPin} title="Usuń pinezkę">
              <X size={13} />
            </button>
          </>
        ) : (
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Pinezka nie została jeszcze ustawiona.</span>
        )}
      </div>

      {/* Przełączniki widoczności */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)' }}>Pokazuj lokalizację na wizytówce</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Główny przełącznik — wyłączenie ukrywa całą sekcję lokalizacji.</div>
          </div>
          <Toggle checked={locationVisible} onChange={onLocationVisibleChange} disabled={!hasPin} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: locationVisible ? 1 : 0.45 }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-dark)' }}>Pokaż mapę z pinezką</div>
          <Toggle checked={showMap} onChange={onShowMapChange} disabled={!locationVisible} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: locationVisible ? 1 : 0.45 }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-dark)' }}>Pokaż link do Google Maps</div>
          <Toggle checked={showGmapsLink} onChange={onShowGmapsLinkChange} disabled={!locationVisible} />
        </div>

        {!hasPin && (
          <p style={{ fontSize: '0.75rem', color: 'var(--error)' }}>
            Ustaw pinezkę na mapie, aby móc włączyć widoczność lokalizacji.
          </p>
        )}
      </div>
    </div>
  )
}