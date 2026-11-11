import { useState } from 'react'
import { CalendarIcon } from './icons'
import { API_URL } from '../../config'
import { useI18n } from '../../i18n/I18nProvider'
import { todayInTz } from '../../utils/cafeTime'

interface Props {
  cafeId: string
  requireLogin: (action: () => void) => void
  authToken: string | null
  previewMode?: boolean
}

export default function SimpleReservationForm({ cafeId, requireLogin, authToken, previewMode = false }: Props) {
  const { t, fmt } = useI18n()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(() => todayInTz(fmt.timeZone))
  const [time, setTime] = useState('12:00')
  const [guests, setGuests] = useState(2)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async () => {
    if (!authToken || previewMode) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/reservations/client/${cafeId}`, {
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
        throw new Error(e.detail || t('res.err'))
      }
      setSuccess(true)
      setTimeout(() => { setSuccess(false); setOpen(false) }, 3500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('res.err'))
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
          data-track="reservation_open"
          style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => { if (!previewMode) requireLogin(() => setOpen(true)) }}
          disabled={previewMode}
          title={previewMode ? t('preview.unavailable') : undefined}
        >
          <CalendarIcon size={16} /> {t('reservation.book')}
        </button>
      ) : (
        <div className="res-table-row" style={{ marginTop: '1rem', maxWidth: 560 }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: '1 1 140px' }}>
              <label className="me-label">{t('res.date')}</label>
              <input type="date" className="me-input" value={date} min={todayInTz(fmt.timeZone)} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '1 1 100px' }}>
              <label className="me-label">{t('res.time')}</label>
              <input type="time" className="me-input" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div className="field" style={{ flex: '1 1 80px' }}>
              <label className="me-label">{t('res.guests')}</label>
              <input type="number" min={1} max={50} className="me-input" value={guests} onChange={e => setGuests(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">{t('res.phone_opt')}</label>
              <input type="tel" className="me-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+48 123 456 789" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">{t('res.email_opt')}</label>
              <input type="email" className="me-input" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ marginTop: '0.75rem' }}>
            <label className="me-label">{t('res.comment')}</label>
            <input type="text" className="me-input" value={comment} onChange={e => setComment(e.target.value)} placeholder={t('res.comment_ph')} />
          </div>

          {error && <div className="form-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
          {success && <div className="form-success" style={{ marginTop: '0.75rem' }}>{t('res.simple_success')}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn--outline-dark" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
            <button type="button" className="btn btn--primary" style={{ width: 'auto' }} onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('res.sending') : t('res.send')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
