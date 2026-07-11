import { useState, useEffect, useCallback } from 'react'

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

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
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
  const [rating, setRating] = useState(initialRating)
  const [comment, setComment] = useState(initialComment)

  return (
    <div className="res-table-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span className="me-label">Ocena</span>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" onClick={() => setRating(n)}
              style={{ appearance: 'none', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--gold)', opacity: n <= rating ? 1 : 0.3 }}>
              ★
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label className="me-label">Komentarz (opcjonalnie)</label>
        <input className="me-input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Podziel się wrażeniami…" maxLength={1000} />
      </div>
      {error && <div className="form-error" style={{ marginTop: '0.5rem' }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.875rem' }}>
        <button type="button" className="btn btn--outline-dark" onClick={onCancel}>Anuluj</button>
        <button type="button" className="btn btn--primary" style={{ width: 'auto' }}
          onClick={() => onSubmit(rating, comment)} disabled={submitting}>
          {submitting ? 'Zapisywanie…' : submitLabel}
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
  return (
    <div className="rv-card" style={{ borderColor: 'var(--gold)', borderWidth: '1.5px' }}>
      <div className="rv-card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="rv-card__nick">{r.nick}</div>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            background: 'rgba(181,114,10,0.12)', color: 'var(--gold)', borderRadius: 100, padding: '1px 8px',
          }}>
            Twoja opinia
          </span>
        </div>
        <Stars rating={r.rating} />
      </div>
      {r.comment && <div className="rv-card__comment">„{r.comment}"</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div className="rv-card__date">{formatDate(r.created_at)}</div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn--outline-dark btn--sm" style={{ width: 'auto' }} onClick={onEdit}>
            Edytuj
          </button>
          <button
            type="button"
            className="btn btn--outline-dark btn--sm"
            style={{ width: 'auto', color: 'var(--error)', borderColor: 'rgba(184,50,50,0.4)' }}
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? 'Usuwanie…' : 'Usuń'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReviewsWidget({ cafeId, average, count, reviews, requireLogin, authToken }: Props) {
  const [list, setList] = useState(reviews)
  const [avg, setAvg] = useState(average)
  const [cnt, setCnt] = useState(count)

  const [myReview, setMyReview] = useState<ReviewItem | null>(null)
  const [loadingMine, setLoadingMine] = useState(false)

  const [formOpen, setFormOpen] = useState(false)   // dodawanie nowej
  const [editOpen, setEditOpen] = useState(false)   // edycja własnej
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Sprawdź, czy zalogowany klient ma już opinię o tej kawiarni ────────

  const fetchMine = useCallback(async () => {
    if (!authToken) { setMyReview(null); return }
    setLoadingMine(true)
    try {
      const res = await fetch(`http://localhost:8000/reviews/client/${cafeId}/mine`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMyReview(data ?? null)
      }
    } catch { /* ignore */ }
    finally { setLoadingMine(false) }
  }, [cafeId, authToken])

  useEffect(() => { fetchMine() }, [fetchMine])

  // Lista bez własnej opinii (żeby się nie dublowała z kartą "Twoja opinia")
  const otherReviews = myReview ? list.filter(r => r.id !== myReview.id) : list

  // ── Dodanie nowej opinii ───────────────────────────────────────────────

  const handleCreate = async (rating: number, comment: string) => {
    if (!authToken) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`http://localhost:8000/reviews/client/${cafeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Błąd dodawania opinii.')
      }
      const created: ReviewItem = await res.json()
      setList(prev => [created, ...prev])
      setAvg(a => Math.round(((a * cnt) + rating) / (cnt + 1) * 100) / 100)
      setCnt(c => c + 1)
      setMyReview(created)
      setFormOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Błąd dodawania opinii.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Edycja własnej opinii ──────────────────────────────────────────────

  const handleUpdate = async (rating: number, comment: string) => {
    if (!authToken || !myReview) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`http://localhost:8000/reviews/client/${myReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Błąd edycji opinii.')
      }
      const updated: ReviewItem = await res.json()
      const oldRating = myReview.rating
      setMyReview(updated)
      setAvg(a => cnt > 0 ? Math.round(((a * cnt) - oldRating + rating) / cnt * 100) / 100 : rating)
      setEditOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Błąd edycji opinii.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Usunięcie własnej opinii ───────────────────────────────────────────

  const handleDelete = async () => {
    if (!authToken || !myReview) return
    if (!confirm('Czy na pewno chcesz usunąć swoją opinię?')) return
    setDeleting(true)
    try {
      const res = await fetch(`http://localhost:8000/reviews/client/${myReview.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok && res.status !== 204) {
        const e = await res.json()
        throw new Error(e.detail || 'Błąd usuwania opinii.')
      }
      setList(prev => prev.filter(r => r.id !== myReview.id))
      setAvg(a => cnt > 1 ? Math.round(((a * cnt) - myReview.rating) / (cnt - 1) * 100) / 100 : 0)
      setCnt(c => Math.max(0, c - 1))
      setMyReview(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Błąd usuwania opinii.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="rv-summary">
        <div className="rv-summary__score">{cnt > 0 ? avg.toFixed(1) : '—'}</div>
        <div className="rv-summary__details">
          <Stars rating={avg} size="1.25rem" />
          <div className="rv-summary__count">{cnt === 0 ? 'Brak opinii' : cnt === 1 ? '1 opinia' : `${cnt} opinii`}</div>
        </div>
        <div style={{ flex: 1 }} />
        {!formOpen && !myReview && !loadingMine && (
          <button type="button" className="btn btn--primary" style={{ width: 'auto', marginTop: 0 }}
            onClick={() => requireLogin(() => setFormOpen(true))}>
            ✎ Dodaj opinię
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
          submitLabel="Wyślij opinię"
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
          submitLabel="Zapisz zmiany"
        />
      )}

      {otherReviews.length === 0 && !myReview ? (
        <p className="cp-muted-note">Bądź pierwszą osobą, która doda opinię o tej kawiarni.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {otherReviews.map(r => (
            <div key={r.id} className="rv-card">
              <div className="rv-card__header">
                <div className="rv-card__nick">{r.nick}</div>
                <Stars rating={r.rating} />
              </div>
              {r.comment && <div className="rv-card__comment">„{r.comment}"</div>}
              <div className="rv-card__date">{formatDate(r.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}