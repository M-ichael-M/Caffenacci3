import { useState, useEffect, useCallback } from 'react'

interface ClientReview {
  id: string
  cafe_id: string
  cafe_name: string
  nick: string
  rating: number
  comment: string | null
  created_at: string
}

interface Props { token: string }

function formatDate(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
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

function ReviewCard({ r }: { r: ClientReview }) {
  return (
    <div className="rv-card">
      <div className="rv-card__header">
        <div className="rv-card__nick">{r.cafe_name}</div>
        <Stars rating={r.rating} />
      </div>
      {r.comment && <div className="rv-card__comment">„{r.comment}"</div>}
      <div className="rv-card__date">{formatDate(r.created_at)}</div>
    </div>
  )
}

export default function MyReviewsTab({ token }: Props) {
  const [reviews, setReviews] = useState<ClientReview[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/reviews/client/mine', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setReviews(data.reviews ?? [])
      }
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <div className="page-header__eyebrow">Twoje konto</div>
        <h1 className="page-header__title" style={{ fontSize: '1.625rem' }}>Twoje opinie</h1>
      </div>

      {reviews.length === 0 ? (
        <div className="res-empty-card">
          <div className="res-empty-icon">💬</div>
          <div className="res-empty-title">Nie dodałeś jeszcze żadnej opinii</div>
          <div className="res-empty-sub">
            Odwiedź stronę swojej ulubionej kawiarni i podziel się wrażeniami.
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