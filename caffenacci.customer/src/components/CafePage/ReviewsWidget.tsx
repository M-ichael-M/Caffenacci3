import { useState } from 'react'

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

export default function ReviewsWidget({ cafeId, average, count, reviews, requireLogin, authToken }: Props) {
  const [list, setList] = useState(reviews)
  const [avg, setAvg] = useState(average)
  const [cnt, setCnt] = useState(count)
  const [formOpen, setFormOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
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
      setFormOpen(false)
      setComment('')
      setRating(5)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Błąd dodawania opinii.')
    } finally {
      setSubmitting(false)
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
        {!formOpen && (
          <button type="button" className="btn btn--primary" style={{ width: 'auto', marginTop: 0 }}
            onClick={() => requireLogin(() => setFormOpen(true))}>
            ✎ Dodaj opinię
          </button>
        )}
      </div>

      {formOpen && (
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
            <button type="button" className="btn btn--outline-dark" onClick={() => setFormOpen(false)}>Anuluj</button>
            <button type="button" className="btn btn--primary" style={{ width: 'auto' }} onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Wysyłanie…' : 'Wyślij opinię'}
            </button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="cp-muted-note">Bądź pierwszą osobą, która doda opinię o tej kawiarni.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {list.map(r => (
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
