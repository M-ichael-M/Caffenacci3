import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import {
  Search, Coffee, Clock, ChevronRight, Star, SlidersHorizontal,
  MapPin, Globe, LocateFixed, X, List, Map as MapIcon,
} from 'lucide-react'
import { BADGE_CATALOG, type BadgeDefinition } from '../badges'
import { API_URL } from '../config'
import ResponsiveImage from './ResponsiveImage'
import { useI18n } from '../i18n/I18nProvider'
import { formatNumber, weekdayName } from '../i18n/localeFormat'
import type { TFunction } from '../i18n/system'

const CafesMap = lazy(() => import('./CafesMap'))

const THUMB_WIDTHS = [128, 256] as const

interface TodayHours { is_closed: boolean; open_time: string | null; close_time: string | null }

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

const RATING_OPTIONS = [3, 3.5, 4, 4.5]
const REVIEWS_OPTIONS = [3, 5, 10]

// ── Kraj: wykrywanie i dopasowanie ────────────────────────────────────────

const COUNTRY_KEY = 'caffenacci_search_country'
const ALL_COUNTRIES = '__all__'

const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

function browserRegion(): string | null {
  try {
    const loc = new Intl.Locale(navigator.language)
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

function formatTodayHours(h: TodayHours | null, t: TFunction): string {
  if (!h) return t('home.hours_unknown')
  if (h.is_closed || !h.open_time || !h.close_time) return t('home.hours_closed')
  return t('home.hours_today', { open: h.open_time, close: h.close_time })
}

const badgeLabel = (t: TFunction, b: BadgeDefinition) => (t.has(`badge.${b.key}`) ? t(`badge.${b.key}`) : b.label)
const badgeInfo = (t: TFunction, b: BadgeDefinition) => (t.has(`badge.${b.key}.info`) ? t(`badge.${b.key}.info`) : undefined)

function RatingBadge({ rating, count }: { rating: number; count: number }) {
  const { t } = useI18n()
  return (
    <span className="cafe-card__rating">
      <Star size={12} fill="currentColor" strokeWidth={0} />
      {rating.toFixed(1)}
      <span className="cafe-card__rating-count">({t('home.reviews', { count })})</span>
    </span>
  )
}

function CafeBadgeChips({ keys }: { keys: string[] }) {
  const { t } = useI18n()
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
            title={badgeInfo(t, def) ?? badgeLabel(t, def)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.6875rem', fontWeight: 600, color: 'var(--gold)',
              background: 'rgba(169,114,47,0.1)', borderRadius: 100,
              padding: '2px 8px', whiteSpace: 'nowrap',
            }}
          >
            <Icon size={11} />
            {badgeLabel(t, def)}
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
  const { t, fmt } = useI18n()
  const tRef = useRef(t)
  tRef.current = t

  const [query, setQuery] = useState('')
  const [countries, setCountries] = useState<string[]>([])
  const [country, setCountry] = useState('')
  const [countryAuto, setCountryAuto] = useState(false)
  const [ready, setReady] = useState(false)

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [panelOpen, setPanelOpen] = useState(false)
  const [view, setView] = useState<'list' | 'map'>('list')
  const [coords, setCoords] = useState<Coords | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const [results, setResults] = useState<CafeResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searched, setSearched] = useState(false)

  const seqRef = useRef(0)
  const firstRun = useRef(true)

  const patch = (p: Partial<Filters>) => setFilters(f => ({ ...f, ...p }))

  useEffect(() => {
    if (!token) setFilters(f => (f.visited === 'any' ? f : { ...f, visited: 'any' }))
  }, [token])

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
      } catch { /* szukamy bez kraju */ }
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

  const runSearch = useCallback(async () => {
    const seq = ++seqRef.current
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (query.trim()) p.set('q', query.trim())
      if (country) p.set('country', country)
      if (filters.nearby && coords) {
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
      setSearchError(null)
      const res = await fetch(`${API_URL}/cafes/search${qs ? `?${qs}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (seq !== seqRef.current) return
      if (res.status === 401 && filters.visited !== 'any') {
        patch({ visited: 'any' })
        setSearchError(tRef.current('home.err_session'))
        return
      }
      if (!res.ok) {
        setResults([])
        setSearchError(tRef.current('home.err_fetch'))
        return
      }
      const data = await res.json()
      if (seq !== seqRef.current) return
      setResults(data.results ?? [])
    } catch {
      if (seq === seqRef.current) {
        setResults([])
        setSearchError(tRef.current('home.err_network'))
      }
    } finally {
      if (seq === seqRef.current) { setLoading(false); setSearched(true) }
    }
  }, [query, country, filters, coords, token])

  useEffect(() => {
    if (!ready || view === 'map') return
    const delay = firstRun.current ? 0 : 350
    firstRun.current = false
    const timer = setTimeout(runSearch, delay)
    return () => clearTimeout(timer)
  }, [ready, view, runSearch])

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
      setGeoError(denied ? t('home.geo_denied') : t('home.geo_failed'))
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
  const [hintA, hintB] = t('home.country_hint').split('{country}')

  return (
    <main className="home-main">
      <section className="home-hero">
        <div className="home-hero__eyebrow">Caffenacci</div>
        <h1 className="home-hero__title">{t('home.title')}</h1>
        <p className="home-hero__subtitle">{t('home.subtitle')}</p>

        <div className="home-searchrow">
          <div className="home-search">
            <span className="home-search__icon"><Search size={17} /></span>
            <input
              type="text"
              className="home-search__input"
              placeholder={t('home.search_ph')}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          {countries.length > 0 && (
            <label className="home-country" title={t('home.country_title')}>
              <Globe size={16} />
              <select value={country} onChange={e => changeCountry(e.target.value)} aria-label={t('home.country_aria')}>
                <option value="">{t('home.all_countries')}</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}

          <div className="view-toggle" role="group" aria-label={t('home.view_aria')}>
            <button type="button" aria-pressed={view === 'list'}
              className={`view-toggle__btn${view === 'list' ? ' view-toggle__btn--on' : ''}`} onClick={() => setView('list')}>
              <List size={15} /> {t('home.view_list')}
            </button>
            <button type="button" aria-pressed={view === 'map'}
              className={`view-toggle__btn${view === 'map' ? ' view-toggle__btn--on' : ''}`} onClick={() => setView('map')}>
              <MapIcon size={15} /> {t('home.view_map')}
            </button>
          </div>

          {view === 'list' && <button
            type="button"
            className={`filters-toggle${panelOpen ? ' filters-toggle--open' : ''}`}
            onClick={() => setPanelOpen(o => !o)}
            aria-expanded={panelOpen}
          >
            <SlidersHorizontal size={16} />
            {t('home.filters')}
            {activeCount > 0 && <span className="filters-toggle__count">{activeCount}</span>}
          </button>}
        </div>

        {countryAuto && country && (
          <p className="home-country-hint">
            {hintA}<strong>{country}</strong>{hintB}
          </p>
        )}

        {panelOpen && view === 'list' && (
          <div className="filters-panel">
            <div className="filter-group">
              <div className="filter-group__label">{t('home.f_nearby')}</div>
              <div className="filter-row">
                <Chip on={filters.nearby} onClick={toggleNearby}>
                  {geoLoading ? <LocateFixed size={14} /> : <MapPin size={14} />}
                  {geoLoading ? t('home.nearby_locating') : filters.nearby ? t('home.nearby_on') : t('home.nearby_off')}
                </Chip>
              </div>
              {filters.nearby && (
                <div className="filter-range">
                  <input
                    type="range" min={1} max={100} step={1}
                    value={filters.radiusKm}
                    onChange={e => patch({ radiusKm: Number(e.target.value) })}
                    aria-label={t('home.radius_aria')}
                  />
                  <span className="filter-range__value">{t('home.radius_value', { km: filters.radiusKm })}</span>
                </div>
              )}
              {geoError && <p className="filter-error" role="alert">{geoError}</p>}
              {filters.nearby && <p className="filter-note">{t('home.nearby_note')}</p>}
            </div>

            {token && (
              <div className="filter-group">
                <div className="filter-group__label">{t('home.f_visits')}</div>
                <div className="filter-row">
                  <Chip on={filters.visited === 'visited'}
                    onClick={() => patch({ visited: filters.visited === 'visited' ? 'any' : 'visited' })}>
                    {t('home.visited')}
                  </Chip>
                  <Chip on={filters.visited === 'not_visited'}
                    onClick={() => patch({ visited: filters.visited === 'not_visited' ? 'any' : 'not_visited' })}>
                    {t('home.not_visited')}
                  </Chip>
                </div>
                <p className="filter-note">{t('home.visits_note')}</p>
              </div>
            )}

            <div className="filter-group">
              <div className="filter-group__label">{t('home.f_reviews')}</div>
              <div className="filter-row">
                {RATING_OPTIONS.map(r => (
                  <Chip key={r} on={filters.minRating === r}
                    onClick={() => patch({ minRating: filters.minRating === r ? null : r })}>
                    <Star size={12} fill="currentColor" strokeWidth={0} /> {formatNumber(r, fmt, { minimumFractionDigits: 1 })}+
                  </Chip>
                ))}
              </div>
              <div className="filter-row">
                {REVIEWS_OPTIONS.map(n => (
                  <Chip key={n} on={filters.minReviews === n}
                    onClick={() => patch({ minReviews: filters.minReviews === n ? null : n })}>
                    {t('home.min_reviews', { n })}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <div className="filter-group__label">{t('home.f_hours')}</div>
              <div className="filter-row">
                <Chip on={filters.openNow} onClick={() => patch({ openNow: !filters.openNow })}>
                  <Clock size={13} /> {t('home.open_now_chip')}
                </Chip>
              </div>
              <div className="filter-row">
                {[0, 1, 2, 3, 4, 5, 6].map(i => (
                  <Chip key={i} on={filters.days.includes(i)} title={weekdayName(i, fmt, 'long')} onClick={() => toggleDay(i)}>
                    {weekdayName(i, fmt, 'short')}
                  </Chip>
                ))}
              </div>
              {filters.days.length > 0 && <p className="filter-note">{t('home.days_note')}</p>}
            </div>

            <div className="filter-group">
              <div className="filter-group__label">{t('home.f_services')}</div>
              <div className="filter-row">
                <Chip on={filters.reservations} onClick={() => patch({ reservations: !filters.reservations })}>
                  {t('home.reservations')}
                </Chip>
                <Chip on={filters.orders} onClick={() => patch({ orders: !filters.orders })}>
                  {t('home.orders')}
                </Chip>
              </div>
            </div>

            <div className="filter-group filter-group--wide">
              <div className="filter-group__label">{t('home.f_amenities')}</div>
              <div className="filter-row">
                {BADGE_CATALOG.map(b => {
                  const Icon = b.icon
                  return (
                    <Chip key={b.key} on={filters.badges.includes(b.key)} title={badgeInfo(t, b)}
                      onClick={() => toggleBadge(b.key)}>
                      <Icon size={13} /> {badgeLabel(t, b)}
                    </Chip>
                  )
                })}
              </div>
            </div>

            <div className="filters-panel__footer">
              <label className="filter-sort">
                {t('home.sort')}
                <select value={filters.sort} onChange={e => patch({ sort: e.target.value as SortKey })}>
                  <option value="relevance">{t('home.sort_relevance')}</option>
                  {filters.nearby && <option value="distance">{t('home.sort_distance')}</option>}
                  <option value="rating">{t('home.sort_rating')}</option>
                  <option value="name">{t('home.sort_name')}</option>
                </select>
              </label>
              {activeCount > 0 && (
                <button type="button" className="link-btn" onClick={clearFilters}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <X size={13} /> {t('home.clear_filters')}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {view === 'map' ? (
        <section className="home-results">
          {ready && <Suspense fallback={<div className="loading-state"><div className="loading-spinner" /></div>}>
            <CafesMap query={query} country={country} />
          </Suspense>}
        </section>
      ) : <section className="home-results">
        {searchError && <div className="form-error" role="alert">{searchError}</div>}
        {loading && results.length === 0 ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>{t('home.searching')}</p>
          </div>
        ) : results.length === 0 && searched ? (
          <div className="home-empty">
            <p>{t('home.none')}</p>
            {activeCount > 0 && (
              <button type="button" className="link-btn" onClick={clearFilters} style={{ marginTop: '0.5rem' }}>
                {t('home.clear_filters')}
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="home-results__count" aria-live="polite">
              {t('home.found', { count: results.length })}
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
                      {cafe.visited && <span className="cafe-card__visited">{t('home.visited_badge')}</span>}
                      {cafe.distance_km != null && (
                        <span className="cafe-card__distance">
                          <MapPin size={12} /> {formatNumber(cafe.distance_km, fmt, { maximumFractionDigits: 1 })} km
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
                      {formatTodayHours(cafe.today_hours, t)}
                      {cafe.is_open_now === true && ` · ${t('home.open_now_suffix')}`}
                    </p>
                    <CafeBadgeChips keys={cafe.featured_badges ?? []} />
                  </div>
                  <ChevronRight size={18} className="cafe-card__chevron" />
                </a>
              ))}
            </div>
          </>
        )}
      </section>}
    </main>
  )
}
