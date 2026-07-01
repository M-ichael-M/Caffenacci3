import { useState, useRef, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Naprawa domyślnej ikonki markera (Leaflet + bundler = klasyczny problem)
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

// ── Typy ─────────────────────────────────────────────────────────────────

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

const DEFAULT_CENTER: [number, number] = [52.0, 19.0] // środek Polski
const DEFAULT_ZOOM = 6
const PIN_ZOOM = 16

// ── Klik na mapie ustawia pinezkę ───────────────────────────────────────

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// ── Programowe przelecenie mapy do punktu (po wyszukaniu adresu) ───────

function FlyTo({ lat, lng, tick }: { lat: number; lng: number; tick: number }) {
  const map = useMap()
  useEffect(() => {
    if (tick > 0) map.flyTo([lat, lng], PIN_ZOOM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
  return null
}

// ── Toggle (spójny z resztą aplikacji) ──────────────────────────────────

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
        background: checked ? 'var(--gold)' : '#fff',
        transition: 'left 0.2s, background 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

// ── Główny komponent ─────────────────────────────────────────────────────

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
  const [flyTick, setFlyTick]   = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasPin = latitude !== null && longitude !== null
  const center: [number, number] = hasPin ? [latitude!, longitude!] : DEFAULT_CENTER

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
    setFlyTick(t => t + 1)
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
          <span style={{ position: 'absolute', right: 0, top: '0.625rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            szukam…
          </span>
        )}
        {showResults && results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 6, marginTop: '0.25rem', overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(17,10,4,0.12)',
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
                  borderBottom: '1px solid var(--border)', fontFamily: 'inherit',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--cream)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="loc-map-container">
        <MapContainer center={center} zoom={hasPin ? PIN_ZOOM : DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={onPositionChange} />
          {hasPin && <FlyTo lat={latitude!} lng={longitude!} tick={flyTick} />}
          {hasPin && (
            <Marker
              position={[latitude!, longitude!]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng()
                  onPositionChange(pos.lat, pos.lng)
                },
              }}
            />
          )}
        </MapContainer>
      </div>

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
              <a href={gmapsUrl} target="_blank" rel="noreferrer" className="link" style={{ fontSize: '0.8125rem' }}>
                Podgląd w Google Maps ↗
              </a>
            )}
            <button type="button" className="me-remove-btn me-remove-item" onClick={clearPin} title="Usuń pinezkę">
              ✕
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