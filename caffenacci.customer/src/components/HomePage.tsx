import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Coffee, Clock, ChevronRight, Star } from 'lucide-react'

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
}

function formatTodayHours(h: TodayHours | null): string {
  if (!h) return 'Brak informacji o godzinach otwarcia'
  if (h.is_closed || !h.open_time || !h.close_time) return 'Dziś zamknięte'
  return `Dziś czynne: ${h.open_time}–${h.close_time}`
}

function RatingBadge({ rating, count }: { rating: number; count: number }) {
  return (
    <span className="cafe-card__rating">
      <Star size={12} fill="currentColor" strokeWidth={0} />
      {rating.toFixed(1)}
      <span className="cafe-card__rating-count">
        ({count === 1 ? '1 opinia' : count < 5 ? `${count} opinie` : `${count} opinii`})
      </span>
    </span>
  )
}

export default function HomePage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CafeResult[]>([])
  const [loading, setLoading] = useState(true)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''
      const res = await fetch(`http://localhost:8000/cafes/search${params}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
      }
    } catch {
      /* ignore — sieć niedostępna */
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }, [])

  // Pierwsze załadowanie — pokaż wszystkie kawiarnie
  useEffect(() => {
    runSearch('')
  }, [runSearch])

  // Wyszukiwanie na żywo (debounce)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <main className="home-main">
      <section className="home-hero">
        <div className="home-hero__eyebrow">Caffenacci</div>
        <h1 className="home-hero__title">Znajdź swoją kawiarnię</h1>
        <p className="home-hero__subtitle">Szukaj po nazwie, ulicy, mieście lub kodzie pocztowym</p>

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
      </section>

      <section className="home-results">
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>Szukanie kawiarni…</p>
          </div>
        ) : results.length === 0 && searched ? (
          <div className="home-empty">
            <p>Nie znaleziono kawiarni pasujących do wyszukiwania.</p>
          </div>
        ) : (
          <div className="cafe-list">
            {results.map(cafe => (
              <a
                key={cafe.cafe_id}
                className="cafe-card"
                href={`/cafe/${cafe.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="cafe-card__logo">
                  {cafe.logo_url ? (
                    <img src={`http://localhost:8000${cafe.logo_url}`} alt={cafe.cafe_name} />
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
                  </div>
                  <p className="cafe-card__address">
                    {cafe.street} {cafe.building_number}, {cafe.postal_code} {cafe.city}
                  </p>
                  <p
                    className={`cafe-card__hours${
                      cafe.today_hours && !cafe.today_hours.is_closed ? ' cafe-card__hours--open' : ''
                    }`}
                  >
                    <Clock size={13} />
                    {formatTodayHours(cafe.today_hours)}
                  </p>
                </div>
                <ChevronRight size={18} className="cafe-card__chevron" />
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
