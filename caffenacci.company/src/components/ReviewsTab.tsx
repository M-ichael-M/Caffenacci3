import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────

interface ReviewOut {
  id:         string
  nick:       string
  rating:     number
  comment:    string | null
  created_at: string
}

interface ReviewListOut {
  reviews:        ReviewOut[]
  average_rating: number
  count:          number
}

interface Props {
  token:  string
  cafeId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function reviewsCountLabel(n: number) {
  if (n === 0) return 'Brak opinii'
  if (n === 1) return '1 opinia'
  if (n < 5)   return `${n} opinie`
  return `${n} opinii`
}

function Stars({ rating, size = '1rem' }: { rating: number; size?: string }) {
  return (
    <span style={{ fontSize: size, letterSpacing: '1px', color: 'var(--gold)', whiteSpace: 'nowrap' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ opacity: i <= Math.round(rating) ? 1 : 0.25 }}>★</span>
      ))}
    </span>
  )
}

// ── Review card ──────────────────────────────────────────────────────────

function ReviewCard({ r }: { r: ReviewOut }) {
  return (
    <div className="rv-card">
      <div className="rv-card__header">
        <div className="rv-card__nick">{r.nick}</div>
        <Stars rating={r.rating} />
      </div>
      {r.comment && <div className="rv-card__comment">„{r.comment}"</div>}
      <div className="rv-card__date">{formatDate(r.created_at)}</div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ReviewsTab({ token, cafeId }: Props) {
  const [data, setData]       = useState<ReviewListOut | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/reviews', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setData(await res.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Wczytywanie opinii…</p>
      </div>
    )
  }

  const reviews = data?.reviews ?? []
  const avg     = data?.average_rating ?? 0
  const count   = data?.count ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Nagłówek ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.25rem' }}>
            Zarządzanie
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
            Opinie o kawiarni
          </h2>
        </div>
        <button
          className="btn btn--outline-dark"
          style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
          onClick={fetchReviews}
        >
          ↻ Odśwież
        </button>
      </div>

      {/* ── Podsumowanie ─────────────────────────────────────────────────── */}
      <div className="rv-summary">
        <div className="rv-summary__score">{count > 0 ? avg.toFixed(1) : '—'}</div>
        <div className="rv-summary__details">
          <Stars rating={avg} size="1.375rem" />
          <div className="rv-summary__count">{reviewsCountLabel(count)}</div>
        </div>
      </div>

      {/* ── Public URL info ────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
        padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          🔗 Link do dodawania opinii dla klientów:
        </span>
        <code style={{
          fontSize: '0.8rem', color: 'var(--gold)', background: 'rgba(181,114,10,0.08)',
          borderRadius: 4, padding: '2px 8px', wordBreak: 'break-all',
        }}>
          POST /reviews/public/{cafeId}
        </code>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          (panel klienta będzie dostępny wkrótce)
        </span>
      </div>

      {/* ── Lista opinii ───────────────────────────────────────────────── */}
      {reviews.length === 0 ? (
        <div className="res-empty-card">
          <div className="res-empty-icon">💬</div>
          <div className="res-empty-title">Brak opinii</div>
          <div className="res-empty-sub">
            Gdy klienci zaczną dodawać opinie, pojawią się tutaj.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {reviews.map(r => <ReviewCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  )
}