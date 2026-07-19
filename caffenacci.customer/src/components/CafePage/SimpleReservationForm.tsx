import { useState } from 'react'
import { CalendarIcon } from './icons'

interface Props {
  cafeId: string
  requireLogin: (action: () => void) => void
  authToken: string | null
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function SimpleReservationForm({ cafeId, requireLogin, authToken }: Props) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('12:00')
  const [guests, setGuests] = useState(2)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!authToken) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`http://localhost:8000/reservations/client/${cafeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          date, start_time: time, guests,
          guest_phone: phone.trim() || null,
          guest_email: email.trim() || null,
          comment: comment.trim() || null,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Błąd rezerwacji.')
      }
      setSuccess(true)
      setTimeout(() => { setSuccess(false); setOpen(false) }, 3500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Błąd rezerwacji.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          className="btn btn--primary"
          style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => requireLogin(() => setOpen(true))}
        >
          <CalendarIcon size={16} /> Zarezerwuj stolik
        </button>
      ) : (
        <div className="res-table-row" style={{ marginTop: '1rem', maxWidth: 560 }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label className="me-label">Data</label>
              <input type="date" className="me-input" value={date} min={todayStr()} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '1 1 100px' }}>
              <label className="me-label">Godzina</label>
              <input type="time" className="me-input" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '1 1 80px' }}>
              <label className="me-label">Goście</label>
              <input type="number" min={1} max={50} className="me-input" value={guests} onChange={e => setGuests(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">Telefon (opcjonalnie)</label>
              <input type="tel" className="me-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+48 123 456 789" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">E-mail (opcjonalnie)</label>
              <input type="email" className="me-input" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label className="me-label">Komentarz</label>
            <input type="text" className="me-input" value={comment} onChange={e => setComment(e.target.value)} placeholder="np. stolik przy oknie…" />
          </div>

          {error && <div className="form-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
          {success && <div className="form-success" style={{ marginTop: '0.75rem' }}>Prośba o rezerwację wysłana! Czekaj na potwierdzenie kawiarni.</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn--outline-dark" onClick={() => setOpen(false)}>Anuluj</button>
            <button type="button" className="btn btn--primary" style={{ width: 'auto' }} onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Wysyłanie…' : 'Wyślij prośbę o rezerwację'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}