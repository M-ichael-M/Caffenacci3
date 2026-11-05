import { useState, useEffect, useCallback } from 'react'
import { Star, Pencil } from 'lucide-react'
import { API_URL } from '../../config'
import { formatDateTime, formatNumber } from '../../i18n/localeFormat' // dostosuj ścieżkę jeśli inna
import { useI18n } from '../../i18n/I18nProvider'
interface ReviewItem {
  id: string
  nick: string
  rating: number
  comment: string | null
  created_at: string
}

interface Props {
  cafeId: string
  average: number
  count: number
  reviews: ReviewItem[]
  requireLogin: (action: () => void) => void
  authToken: string | null
  previewMode?: boolean
}

const REVIEWS_PAGE = 10

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, color: 'var(--gold)' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          fill={i <= Math.round(rating) ? 'currentColor' : 'none'}
          strokeWidth={i <= Math.round(rating) ? 0 : 1.5}
          style={{ opacity: i <= Math.round(rating) ? 1 : 0.35 }}
        />
      ))}
    </span>
  )
}

// ── Formularz oceny (wspólny dla dodawania i edycji) ─────────────────────

function RatingForm({
  initialRating, initialComment, onSubmit, onCancel, submitting, error, submitLabel,
}: {
  initialRating: number
  initialComment: string
  onSubmit: (rating: number, comment: string) => void
  onCancel: () => void
  submitting: boolean
  error: string | null
  submitLabel: string
}) {
  const { t } = useI18n()
  const [rating, setRating] = useState(initialRating)
  const [comment, setComment] = useState(initialComment)

  return (
    <div className="res-table-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span className="me-label">{t('reviews.rating')}</span>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => setRating(n)}
              style={{ appearance: 'none', border: 'none', background: 'none', cursor: 'pointer', display: 'inline-flex', color: 'var(--gold)', opacity: n <= rating ? 1 : 0.3 }}>
              <Star size={20} fill={n <= rating ? 'currentColor' : 'none'} strokeWidth={n <= rating ? 0 : 1.5} />
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="me-label">{t('reviews.comment_optional')}</label>
        <input
          className="me-input"
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder={t('reviews.comment_placeholder')}
          maxLength={1000}
        />
      </div>
      {error && <div className="form-error" style={{ marginTop: '0.5rem' }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.875rem' }}>
        <button type="button" className="btn btn--outline-dark" onClick={onCancel}>
          {t('reviews.cancel')}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          style={{ width: 'auto' }}
          onClick={() => onSubmit(rating, comment)}
          disabled={submitting}
        >
          {submitting ? t('reviews.saving') : submitLabel}
        </button>
      </div>
    </div>
  )
}

// ── Karta własnej opinii — z akcjami edycji / usunięcia ──────────────────

function MyReviewCard({ r, onEdit, onDelete, deleting }: {
  r: ReviewItem
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const { t, fmt } = useI18n()
  const fmtDate = (s: string) => formatDateTime(s, fmt, { dateStyle: 'long' })

  return (
    <div className="rv-card" style={{ borderColor: 'var(--gold)', borderWidth: '1.5px' }}>
      <div className="rv-card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="rv-card__nick">{r.nick}</div>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: 'rgba(181,114,10,0.12)', color: 'var(--gold)', borderRadius: 100, padding: '1px 8px',
          }}>
            {t('reviews.your_review')}
          </span>
        </div>
        <Stars rating={r.rating} />
      </div>
      {r.comment && <div className="rv-card__comment">„{r.comment}"</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="rv-card__date">{fmtDate(r.created_at)}</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn--outline-dark btn--sm" style={{ width: 'auto' }} onClick={onEdit}>
            {t('reviews.edit')}
          </button>
          <button
            type="button"
            className="btn btn--outline-dark btn--sm"
            style={{ width: 'auto', color: 'var(--error)', borderColor: 'rgba(184,50,50,0.4)' }}
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? t('reviews.deleting') : t('reviews.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReviewsWidget({ cafeId, average, count, reviews, requireLogin, authToken, previewMode = false }: Props) {
  const { t, fmt } = useI18n()

  const [list, setList] = useState(reviews)
  const [avg, setAvg] = useState(average)
  const [cnt, setCnt] = useState(count)
  const [serverOffset, setServerOffset] = useState(reviews.length)
  const [exhausted, setExhausted] = useState(reviews.length >= count)
  const [loadingMore, setLoadingMore] = useState(false)

  const [myReview, setMyReview] = useState<ReviewItem | null>(null)
  const [loadingMine, setLoadingMine] = useState(false)

  const [formOpen, setFormOpen] = useState(false)   // dodawanie nowej
  const [editOpen, setEditOpen] = useState(false)   // edycja własnej
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fmtDate = (s: string) => formatDateTime(s, fmt, { dateStyle: 'long' })
  const scoreText = formatNumber(avg, fmt, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const countText = cnt === 0 ? t('reviews.none') : t('reviews.count', { count: cnt })

  // ── Sprawdź, czy zalogowany klient ma już opinię o tej kawiarni ────────

  const fetchMine = useCallback(async () => {
    if (!authToken || previewMode) { setMyReview(null); return }
    setLoadingMine(true)
    try {
      const res = await fetch(`${API_URL}/reviews/client/${cafeId}/mine`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMyReview(data ?? null)
      }
    } catch { /* ignore */ }
    finally { setLoadingMine(false) }
  }, [cafeId, authToken, previewMode])

  useEffect(() => { fetchMine() }, [fetchMine])

  // Lista bez własnej opinii (żeby się nie dublowała z kartą "Twoja opinia")
  const otherReviews = myReview ? list.filter(r => r.id !== myReview.id) : list

  // ── Paginacja – dociąganie kolejnych opinii ────────────────────────────

  const loadMore = async () => {
    setLoadingMore(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/reviews/public/${cafeId}?offset=${serverOffset}&limit=${REVIEWS_PAGE}`)
      if (!res.ok) throw new Error(t('reviews.err_more'))
      const data: { reviews: ReviewItem[]; count: number } = await res.json()
      setList(prev => {
        const seen = new Set(prev.map(r => r.id))
        return [...prev, ...data.reviews.filter(r => !seen.has(r.id))]
      })
      setServerOffset(o => o + data.reviews.length)
      setExhausted(serverOffset + data.reviews.length >= data.count || data.reviews.length === 0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('reviews.err_fetch'))
    } finally {
      setLoadingMore(false)
    }
  }

  // ── Dodanie nowej opinii ───────────────────────────────────────────────

  const handleCreate = async (rating: number, comment: string) => {
    if (!authToken || previewMode) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/reviews/client/${cafeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || t('reviews.err_add'))
      }
      const created: ReviewItem = await res.json()
      setList(prev => [created, ...prev])
      setServerOffset(o => o + 1)
      setAvg(a => Math.round(((a * cnt) + rating) / (cnt + 1) * 100) / 100)
      setCnt(c => c + 1)
      setMyReview(created)
      setFormOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('reviews.err_add'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Edycja własnej opinii ──────────────────────────────────────────────

  const handleUpdate = async (rating: number, comment: string) => {
    if (!authToken || !myReview || previewMode) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/reviews/client/${myReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || t('reviews.err_edit'))
      }
      const updated: ReviewItem = await res.json()
      const oldRating = myReview.rating
      setMyReview(updated)
      setAvg(a => cnt > 0 ? Math.round(((a * cnt) - oldRating + rating) / cnt * 100) / 100 : rating)
      setEditOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('reviews.err_edit'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Usunięcie własnej opinii ───────────────────────────────────────────

  const handleDelete = async () => {
    if (!authToken || !myReview || previewMode) return
    if (!confirm(t('reviews.confirm_delete'))) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_URL}/reviews/client/${myReview.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok && res.status !== 204) {
        const e = await res.json()
        throw new Error(e.detail || t('reviews.err_delete'))
      }
      if (list.some(r => r.id === myReview.id)) setServerOffset(o => Math.max(0, o - 1))
      setList(prev => prev.filter(r => r.id !== myReview.id))
      setAvg(a => cnt > 1 ? Math.round(((a * cnt) - myReview.rating) / (cnt - 1) * 100) / 100 : 0)
      setCnt(c => Math.max(0, c - 1))
      setMyReview(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('reviews.err_delete'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="rv-summary">
        <div className="rv-summary__score">{cnt > 0 ? scoreText : '—'}</div>
        <div className="rv-summary__details">
          <Stars rating={avg} size={20} />
          <div className="rv-summary__count">{countText}</div>
        </div>
        <div style={{ flex: 1 }} />
        {!formOpen && !myReview && !loadingMine && (
          <button
            type="button"
            className="btn btn--primary"
            style={{ width: 'auto', marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => { if (!previewMode) requireLogin(() => setFormOpen(true)) }}
            disabled={previewMode}
            title={previewMode ? t('reviews.preview_unavailable') : undefined}
          >
            <Pencil size={15} /> {t('reviews.add')}
          </button>
        )}
      </div>

      {error && !formOpen && !editOpen && <div className="form-error">{error}</div>}

      {/* Formularz dodawania nowej opinii */}
      {formOpen && (
        <RatingForm
          initialRating={5}
          initialComment=""
          onSubmit={handleCreate}
          onCancel={() => { setFormOpen(false); setError(null) }}
          submitting={submitting}
          error={error}
          submitLabel={t('reviews.submit')}
        />
      )}

      {/* Własna opinia — karta z akcjami, albo formularz edycji */}
      {myReview && !editOpen && (
        <MyReviewCard
          r={myReview}
          onEdit={() => { setEditOpen(true); setError(null) }}
          onDelete={handleDelete}
          deleting={deleting}
        />
      )}
      {myReview && editOpen && (
        <RatingForm
          initialRating={myReview.rating}
          initialComment={myReview.comment ?? ''}
          onSubmit={handleUpdate}
          onCancel={() => { setEditOpen(false); setError(null) }}
          submitting={submitting}
          error={error}
          submitLabel={t('reviews.save')}
        />
      )}

      {otherReviews.length === 0 && !myReview ? (
        <p className="cp-muted-note">{t('reviews.be_first')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {otherReviews.map(r => (
            <div key={r.id} className="rv-card">
              <div className="rv-card__header">
                <div className="rv-card__nick">{r.nick}</div>
                <Stars rating={r.rating} />
              </div>
              {r.comment && <div className="rv-card__comment">„{r.comment}"</div>}
              <div className="rv-card__date">{fmtDate(r.created_at)}</div>
            </div>
          ))}
          {!exhausted && (
            <button
              type="button"
              className="btn btn--outline-dark"
              style={{ alignSelf: 'center', width: 'auto' }}
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? t('reviews.loading') : t('reviews.show_more')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}