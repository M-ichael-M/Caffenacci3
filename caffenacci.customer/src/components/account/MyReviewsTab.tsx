import { useState, useEffect, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import { API_URL } from '../../config'
import { useI18n } from '../../i18n/I18nProvider'
import { formatDateTime } from '../../i18n/localeFormat'

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
  const { fmt } = useI18n()
  return (
    <div className="rv-card">
      <div className="rv-card__header">
        <div className="rv-card__nick">{r.cafe_name}</div>
        <Stars rating={r.rating} />
      </div>
      {r.comment && <div className="rv-card__comment">„{r.comment}”</div>}
      <div className="rv-card__date">
        {formatDateTime(r.created_at, fmt, { day: 'numeric', month: 'long', year: 'numeric' })}
      </div>
    </div>
  )
}

export default function MyReviewsTab({ token }: Props) {
  const { t } = useI18n()
  const [reviews, setReviews] = useState<ClientReview[]>([])
  const [loading, setLoading] = useState(true)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/reviews/client/mine`, { headers: { Authorization: `Bearer ${token}` } })
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
        <p>{t('rev.loading')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <div className="page-header__eyebrow">{t('acc.eyebrow')}</div>
        <h1 className="page-header__title" style={{ fontSize: '1.625rem' }}>{t('rev.title')}</h1>
      </div>

      {reviews.length === 0 ? (
        <div className="res-empty-card">
          <div className="res-empty-icon"><MessageCircle size={44} strokeWidth={1.4} /></div>
          <div className="res-empty-title">{t('rev.empty_title')}</div>
          <div className="res-empty-sub">{t('rev.empty_sub')}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {reviews.map(r => <ReviewCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  )
}
