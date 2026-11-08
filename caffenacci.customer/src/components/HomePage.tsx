import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, Coffee, Clock, ChevronRight, Star, SlidersHorizontal,
  MapPin, Globe, LocateFixed, X,
} from 'lucide-react'
import { BADGE_CATALOG } from '../badges'
import { API_URL } from '../config'
import ResponsiveImage from './ResponsiveImage'

const THUMB_WIDTHS = [128, 256] as const

// ── Typy ──────────────────────────────────────────────────────────────────

interface TodayHours {
  is_closed: boolean
  open_time: string | null
  close_time: string | null
}

interface CafeResult {
  cafe_id: string
  slug: string
  cafe_name: string
  country: string
  city: string
  street: string
  building_number: string
  postal_code: string
  logo_url: string | null
  today_hours: TodayHours | null
  average_rating?: number | null
  review_count?: number
  featured_badges?: string[]
  distance_km?: number | null
  is_open_now?: boolean | null
  visited?: boolean | null
}

type SortKey = 'relevance' | 'distance' | 'rating' | 'name'
type VisitedFilter = 'any' | 'visited' | 'not_visited'

interface Filters {
  minRating: number | null
  minReviews: number | null
  openNow: boolean
  days: number[]
  reservations: boolean
  orders: boolean
  badges: string[]
  nearby: boolean
  radiusKm: number
  sort: SortKey
  visited: VisitedFilter
}

interface Coords { lat: number; lng: number }

const DEFAULT_FILTERS: Filters = {
  minRating: null, minReviews: null, openNow: false, days: [],
  reservations: false, orders: false, badges: [],
  nearby: false, radiusKm: 10, sort: 'relevance', visited: 'any',
}

const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
const DAY_TITLES = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']
const RATING_OPTIONS = [3, 3.5, 4, 4.5]
const REVIEWS_OPTIONS = [3, 5, 10]

// ── Kraj: wykrywanie i dopasowanie ────────────────────────────────────────

const COUNTRY_KEY = 'caffenacci_search_country'
const ALL_COUNTRIES = '__all__'

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function browserRegion(): string | null {
  try {
    const lang = navigator.language
    const loc = new Intl.Locale(lang)
    return (loc.region ?? loc.maximize().region ?? null)?.toUpperCase() ?? null
  } catch { return null }
}

function regionNames(code: string): string[] {
  const out: string[] = []
  for (const l of ['pl', 'en']) {
    try {
      const n = new Intl.DisplayNames([l], { type: 'region' }).of(code)
      if (n) out.push(norm(n))
    } catch { /* ignore */ }
  }
  return out
}

function matchCountry(list: string[], code: string | null): string {
  if (!code) return ''
  const names = regionNames(code)
  return list.find(c => names.includes(norm(c))) ?? ''
}

function readSavedCountry(): string | null {
  try { return localStorage.getItem(COUNTRY_KEY) } catch { return null }
}
function writeSavedCountry(v: string) {
  try { localStorage.setItem(COUNTRY_KEY, v || ALL_COUNTRIES) } catch { /* ignore */ }
}

// ── Geolokalizacja ────────────────────────────────────────────────────────

function requestLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('unsupported')); return }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      e => reject(e),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  })
}

// ── Pomocnicze UI ─────────────────────────────────────────────────────────

function formatTodayHours(h: TodayHours | null): string {
  if (!h) return 'Brak informacji o godzinach otwarcia'
  if (h.is_closed || !h.open_time || !h.close_time) return 'Dziś zamknięte'
  return `Dziś czynne: ${h.open_time}–${h.close_time}`
}

function formatDistance(km: number): string {
  return `${km.toLocaleString('pl-PL', { maximumFractionDigits: 1 })} km`
}

function reviewsWord(count: number) {
  return count === 1 ? '1 opinia' : count < 5 ? `${count} opinie` : `${count} opinii`
}

function RatingBadge({ rating, count }: { rating: number; count: number }) {
  return (
    <span className="cafe-card__rating">
      <Star size={12} fill="currentColor" strokeWidth={0} />
      {rating.toFixed(1)}
      <span className="cafe-card__rating-count">({reviewsWord(count)})</span>
    </span>
  )
}

function CafeBadgeChips({ keys }: { keys: string[] }) {
  if (keys.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
      {keys.map(key => {
        const def = BADGE_CATALOG.find(b => b.key === key)
        if (!def) return null
        const Icon = def.icon
        return (
          <span
            key={key}
            title={def.info ?? def.label}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gold)',
              background: 'rgba(169,114,47,0.1)', borderRadius: 100,
              padding: '2px 8px', whiteSpace: 'nowrap',
            }}
          >
            <Icon size={11} />
            {def.label}
          </span>
        )
      })}
    </div>
  )
}

function Chip({ on, onClick, children, title }: {
  on: boolean; onClick: () => void; children: React.ReactNode; title?: string
}) {
  return (
    <button type="button" title={title} aria-pressed={on}
      className={`filter-chip${on ? ' filter-chip--on' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

// ═════════════════════════════════════════════════════════════════════════

export default function HomePage({ token = null }: { token?: string | null }) {
  const [query, setQuery] = useState('')
  const [countries, setCountries] = useState<string[]>([])
  const [country, setCountry] = useState('')
  const [countryAuto, setCountryAuto] = useState(false)
  const [ready, setReady] = useState(false)          // kraj ustalony → można szukać

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [panelOpen, setPanelOpen] = useState(false)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const [results, setResults] = useState<CafeResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searched, setSearched] = useState(false)

  const seqRef = useRef(0)
  const firstRun = useRef(true)

  const patch = (p: Partial<Filters>) => setFilters(f => ({ ...f, ...p }))

  // Wylogowanie / wygaśnięcie sesji → filtr historii nie ma sensu
  useEffect(() => {
    if (!token) setFilters(f => (f.visited === 'any' ? f : { ...f, visited: 'any' }))
  }, [token])

  // ── Kraj domyślny: zapisany wybór → kraj z CDN → region przeglądarki ──
  useEffect(() => {
    let off = false
    ;(async () => {
      let list: string[] = []
      let code: string | null = null
      try {
        const res = await fetch(`${API_URL}/cafes/meta`)
        if (res.ok) {
          const d = await res.json()
          list = d.countries ?? []
          code = d.detected_country_code ?? null
        }
      } catch { /* sieć niedostępna — szukamy bez kraju */ }
      if (off) return

      setCountries(list)
      const saved = readSavedCountry()
      if (saved === ALL_COUNTRIES) {
        setCountry('')
      } else if (saved && list.includes(saved)) {
        setCountry(saved)
      } else {
        const detected = matchCountry(list, code ?? browserRegion())
        setCountry(detected)
        setCountryAuto(!!detected)
      }
      setReady(true)
    })()
    return () => { off = true }
  }, [])

  const changeCountry = (v: string) => {
    setCountry(v)
    setCountryAuto(false)
    writeSavedCountry(v)
  }

  // ── Wyszukiwanie ──
  const runSearch = useCallback(async () => {
    const seq = ++seqRef.current
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (query.trim()) p.set('q', query.trim())
      if (country) p.set('country', country)
      if (filters.nearby && coords) {
        // ~100 m dokładności wystarcza i nie wysyłamy dokładnej pozycji
        p.set('lat', coords.lat.toFixed(3))
        p.set('lng', coords.lng.toFixed(3))
        p.set('radius_km', String(filters.radiusKm))
      }
      if (filters.minRating) p.set('min_rating', String(filters.minRating))
      if (filters.minReviews) p.set('min_reviews', String(filters.minReviews))
      if (filters.openNow) p.set('open_now', 'true')
      if (token && filters.visited !== 'any') p.set('visited', filters.visited)
      filters.days.forEach(d => p.append('open_days', String(d)))
      if (filters.reservations) p.set('reservations', 'true')
      if (filters.orders) p.set('orders', 'true')
      filters.badges.forEach(b => p.append('badges', b))
      const sort = filters.sort === 'distance' && !(filters.nearby && coords) ? 'relevance' : filters.sort
      if (sort !== 'relevance') p.set('sort', sort)

      const qs = p.toString()
      const res = await fetch(`${API_URL}/cafes/search${qs ? `?${qs}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (seq !== seqRef.current) return
      if (res.status === 401 && filters.visited !== 'any') {
        patch({ visited: 'any' })
        return
      }
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
      }
    } catch {
      /* ignore — sieć niedostępna */
    } finally {
      if (seq === seqRef.current) { setLoading(false); setSearched(true) }
    }
  }, [query, country, filters, coords, token])

  useEffect(() => {
    if (!ready) return
    const delay = firstRun.current ? 0 : 350
    firstRun.current = false
    const t = setTimeout(runSearch, delay)
    return () => clearTimeout(t)
  }, [ready, runSearch])

  // ── W okolicy ──
  const toggleNearby = async () => {
    setGeoError(null)
    if (filters.nearby) {
      patch({ nearby: false, sort: filters.sort === 'distance' ? 'relevance' : filters.sort })
      return
    }
    if (coords) { patch({ nearby: true, sort: 'distance' }); return }
    setGeoLoading(true)
    try {
      setCoords(await requestLocation())
      patch({ nearby: true, sort: 'distance' })
    } catch (e) {
      const denied = (e as GeolocationPositionError)?.code === 1
      setGeoError(denied
        ? 'Brak zgody na lokalizację — zezwól na nią w ustawieniach przeglądarki.'
        : 'Nie udało się ustalić Twojej lokalizacji.')
    } finally {
      setGeoLoading(false)
    }
  }

  const toggleDay = (d: number) =>
    patch({ days: filters.days.includes(d) ? filters.days.filter(x => x !== d) : [...filters.days, d].sort() })
  const toggleBadge = (k: string) =>
    patch({ badges: filters.badges.includes(k) ? filters.badges.filter(x => x !== k) : [...filters.badges, k] })

  const clearFilters = () => { setFilters(DEFAULT_FILTERS); setGeoError(null) }

  const activeCount =
    (filters.minRating ? 1 : 0) + (filters.minReviews ? 1 : 0) + (filters.openNow ? 1 : 0) +
    (filters.days.length ? 1 : 0) + (filters.reservations ? 1 : 0) + (filters.orders ? 1 : 0) +
    filters.badges.length + (filters.nearby ? 1 : 0) + (filters.visited !== 'any' ? 1 : 0)

  const refreshing = loading && results.length > 0

  return (
    <main className="home-main">
      <section className="home-hero">
        <div className="home-hero__eyebrow">Caffenacci</div>
        <h1 className="home-hero__title">Znajdź swoją kawiarnię</h1>
        <p className="home-hero__subtitle">Szukaj po nazwie, ulicy, mieście lub kodzie pocztowym</p>

        <div className="home-searchrow">
          <div className="home-search">
            <span className="home-search__icon"><Search size={17} /></span>
            <input
              type="text"
              className="home-search__input"
              placeholder="np. Kawiarnia Pod Lipą, Warszawa, Marszałkowska…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          {countries.length > 0 && (
            <label className="home-country" title="Kraj, w którym szukasz kawiarni">
              <Globe size={16} />
              <select value={country} onChange={e => changeCountry(e.target.value)} aria-label="Kraj">
                <option value="">Wszystkie kraje</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}

          <button
            type="button"
            className={`filters-toggle${panelOpen ? ' filters-toggle--open' : ''}`}
            onClick={() => setPanelOpen(o => !o)}
            aria-expanded={panelOpen}
          >
            <SlidersHorizontal size={16} />
            Filtry
            {activeCount > 0 && <span className="filters-toggle__count">{activeCount}</span>}
          </button>
        </div>

        {countryAuto && country && (
          <p className="home-country-hint">
            Szukasz w kraju: <strong>{country}</strong> (wykryty automatycznie) — możesz to zmienić powyżej.
          </p>
        )}

        {panelOpen && (
          <div className="filters-panel">
            {/* W okolicy */}
            <div className="filter-group">
              <div className="filter-group__label">W okolicy</div>
              <div className="filter-row">
                <Chip on={filters.nearby} onClick={toggleNearby}>
                  {geoLoading ? <LocateFixed size={14} /> : <MapPin size={14} />}
                  {geoLoading ? 'Ustalanie lokalizacji…' : filters.nearby ? 'W pobliżu: włączone' : 'Szukaj w pobliżu mnie'}
                </Chip>
              </div>
              {filters.nearby && (
                <div className="filter-range">
                  <input
                    type="range" min={1} max={100} step={1}
                    value={filters.radiusKm}
                    onChange={e => patch({ radiusKm: Number(e.target.value) })}
                    aria-label="Promień wyszukiwania w kilometrach"
                  />
                  <span className="filter-range__value">do {filters.radiusKm} km</span>
                </div>
              )}
              {geoError && <p className="filter-error" role="alert">{geoError}</p>}
              {filters.nearby && (
                <p className="filter-note">
                  Pokazujemy tylko kawiarnie, które udostępniają swoją lokalizację na mapie.
                </p>
              )}
            </div>

            {token && (
              <div className="filter-group">
                <div className="filter-group__label">Twoje wizyty</div>
                <div className="filter-row">
                  <Chip on={filters.visited === 'visited'}
                    onClick={() => patch({ visited: filters.visited === 'visited' ? 'any' : 'visited' })}>
                    Byłem
                  </Chip>
                  <Chip on={filters.visited === 'not_visited'}
                    onClick={() => patch({ visited: filters.visited === 'not_visited' ? 'any' : 'not_visited' })}>
                    Jeszcze nie byłem
                  </Chip>
                </div>
                <p className="filter-note">
                  Liczymy zrealizowane zamówienia, minione rezerwacje i wizyty z programu lojalnościowego.
                </p>
              </div>
            )}

            {/* Opinie */}
            <div className="filter-group">
              <div className="filter-group__label">Opinie</div>
              <div className="filter-row">
                {RATING_OPTIONS.map(r => (
                  <Chip key={r} on={filters.minRating === r}
                    onClick={() => patch({ minRating: filters.minRating === r ? null : r })}>
                    <Star size={12} fill="currentColor" strokeWidth={0} /> {r.toFixed(1)}+
                  </Chip>
                ))}
              </div>
              <div className="filter-row">
                {REVIEWS_OPTIONS.map(n => (
                  <Chip key={n} on={filters.minReviews === n}
                    onClick={() => patch({ minReviews: filters.minReviews === n ? null : n })}>
                    min. {n} opinii
                  </Chip>
                ))}
              </div>
            </div>

            {/* Godziny */}
            <div className="filter-group">
              <div className="filter-group__label">Godziny otwarcia</div>
              <div className="filter-row">
                <Chip on={filters.openNow} onClick={() => patch({ openNow: !filters.openNow })}>
                  <Clock size={13} /> Otwarte teraz
                </Chip>
              </div>
              <div className="filter-row">
                {DAY_LABELS.map((l, i) => (
                  <Chip key={l} on={filters.days.includes(i)} title={DAY_TITLES[i]} onClick={() => toggleDay(i)}>
                    {l}
                  </Chip>
                ))}
              </div>
              {filters.days.length > 0 && (
                <p className="filter-note">Kawiarnia musi być otwarta we wszystkie zaznaczone dni.</p>
              )}
            </div>

            {/* Usługi */}
            <div className="filter-group">
              <div className="filter-group__label">Usługi</div>
              <div className="filter-row">
                <Chip on={filters.reservations} onClick={() => patch({ reservations: !filters.reservations })}>
                  Rezerwacje online
                </Chip>
                <Chip on={filters.orders} onClick={() => patch({ orders: !filters.orders })}>
                  Zamówienia online
                </Chip>
              </div>
            </div>

            {/* Plakietki */}
            <div className="filter-group filter-group--wide">
              <div className="filter-group__label">Udogodnienia</div>
              <div className="filter-row">
                {BADGE_CATALOG.map(b => {
                  const Icon = b.icon
                  return (
                    <Chip key={b.key} on={filters.badges.includes(b.key)} title={b.info}
                      onClick={() => toggleBadge(b.key)}>
                      <Icon size={13} /> {b.label}
                    </Chip>
                  )
                })}
              </div>
            </div>

            <div className="filters-panel__footer">
              <label className="filter-sort">
                Sortuj:
                <select value={filters.sort} onChange={e => patch({ sort: e.target.value as SortKey })}>
                  <option value="relevance">Trafność / nazwa</option>
                  {filters.nearby && <option value="distance">Najbliższe</option>}
                  <option value="rating">Najwyżej oceniane</option>
                  <option value="name">Nazwa A–Z</option>
                </select>
              </label>
              {activeCount > 0 && (
                <button type="button" className="link-btn" onClick={clearFilters}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <X size={13} /> Wyczyść filtry
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="home-results">
        {loading && results.length === 0 ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Szukanie kawiarni…</p>
          </div>
        ) : results.length === 0 && searched ? (
          <div className="home-empty">
            <p>Nie znaleziono kawiarni pasujących do wyszukiwania.</p>
            {activeCount > 0 && (
              <button type="button" className="link-btn" onClick={clearFilters} style={{ marginTop: '0.5rem' }}>
                Wyczyść filtry
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="home-results__count" aria-live="polite">
              {results.length === 1 ? '1 kawiarnia' : `Znalezione kawiarnie: ${results.length}`}
              {country ? ` · ${country}` : ''}
            </p>
            <div className={`cafe-list${refreshing ? ' cafe-list--refreshing' : ''}`}>
              {results.map(cafe => (
                <a
                  key={cafe.cafe_id}
                  className="cafe-card"
                  href={`/kawiarnia/${encodeURIComponent(cafe.slug)}`}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="cafe-card__logo">
                    {cafe.logo_url ? (
                      <ResponsiveImage src={cafe.logo_url} alt={cafe.cafe_name} widths={THUMB_WIDTHS} sizes="64px" />
                    ) : (
                      <Coffee size={24} />
                    )}
                  </div>
                  <div className="cafe-card__info">
                    <div className="cafe-card__title-row">
                      <h2 className="cafe-card__name">{cafe.cafe_name}</h2>
                      {!!cafe.average_rating && !!cafe.review_count && (
                        <RatingBadge rating={cafe.average_rating} count={cafe.review_count} />
                      )}
                      {cafe.visited && <span className="cafe-card__visited">Byłeś tu</span>}
                      {cafe.distance_km != null && (
                        <span className="cafe-card__distance">
                          <MapPin size={12} /> {formatDistance(cafe.distance_km)}
                        </span>
                      )}
                    </div>
                    <p className="cafe-card__address">
                      {cafe.street} {cafe.building_number}, {cafe.postal_code} {cafe.city}
                    </p>
                    <p
                      className={`cafe-card__hours${
                        cafe.is_open_now ?? (cafe.today_hours && !cafe.today_hours.is_closed) ? ' cafe-card__hours--open' : ''
                      }`}
                    >
                      <Clock size={13} />
                      {formatTodayHours(cafe.today_hours)}
                      {cafe.is_open_now === true && ' · otwarte teraz'}
                    </p>
                    <CafeBadgeChips keys={cafe.featured_badges ?? []} />
                  </div>
                  <ChevronRight size={18} className="cafe-card__chevron" />
                </a>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  )
}