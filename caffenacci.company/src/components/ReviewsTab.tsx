import { useState, useEffect, useCallback } from 'react'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'

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
  const { locale } = useI18n()
  const date = new Date(r.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="rv-card">
      <div className="rv-card__header">
        {/* Nick i komentarz napisał gość — nie tłumaczymy ich automatycznie */}
        <div className="rv-card__nick" translate="no">{r.nick}</div>
        <Stars rating={r.rating} />
      </div>
      {r.comment && <div className="rv-card__comment" translate="no">„{r.comment}”</div>}
      <div className="rv-card__date">{date}</div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ReviewsTab({ token }: Props) {
  const { t, locale } = useI18n()
  const [data, setData]       = useState<ReviewListOut | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/reviews`, {
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
        <p>{t('reviews.loading')}</p>
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
          <div className="page-header__eyebrow" style={{ marginBottom: '0.25rem' }}>
            {t('common.management')}
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
            {t('reviews.title')}
          </h2>
        </div>
        <button
          className="btn btn--outline-dark"
          style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={fetchReviews}
        >
          <RefreshCw size={15} />
          {t('common.refresh')}
        </button>
      </div>

      {/* ── Podsumowanie ─────────────────────────────────────────────────── */}
      <div className="rv-summary">
        <div className="rv-summary__score">
          {count > 0 ? avg.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
        </div>
        <div className="rv-summary__details">
          <Stars rating={avg} size="1.375rem" />
          <div className="rv-summary__count">
            {count === 0 ? t('reviews.count.none') : t('reviews.count', { count })}
          </div>
        </div>
      </div>


      {/* ── Lista opinii ───────────────────────────────────────────────── */}
      {reviews.length === 0 ? (
        <div className="res-empty-card">
          <div className="res-empty-icon"><MessageCircle size={44} strokeWidth={1.4} /></div>
          <div className="res-empty-title">{t('reviews.empty.title')}</div>
          <div className="res-empty-sub">{t('reviews.empty.sub')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {reviews.map(r => <ReviewCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  )
}