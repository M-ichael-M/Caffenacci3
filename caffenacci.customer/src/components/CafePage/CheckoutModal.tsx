import { useState, useMemo, useEffect } from 'react'
import { CreditCardIcon } from './icons'
import { API_URL } from '../../config'
import { useI18n } from '../../i18n/I18nProvider'
import { formatCurrency } from '../../i18n/localeFormat'
import { addDays, todayInTz, nowInTz, fromMinutes, hoursOn, sessionsFor, offsetLabel, differsFromBrowser } from '../../utils/cafeTime'
interface WeeklyHours { day_of_week: number; open_time: string | null; close_time: string | null }
interface HourException { date: string; is_closed: boolean; open_time: string | null; close_time: string | null }

export interface CheckoutLine {
  item: { id: string; name: string; price: number }
  qty: number
}

interface Props {
  cafeId: string
  authToken: string | null
  lines: CheckoutLine[]
  weeklyHours: WeeklyHours[]
  hourExceptions: HourException[]
  previewMode?: boolean
  onClose: () => void
  onSuccess: () => void
}

const ORDER_BUFFER_MINUTES = 15
const ORDER_LEAD_MINUTES = 15
const SLOT_STEP_MINUTES = 15

export default function CheckoutModal({
  cafeId, authToken, lines, weeklyHours, hourExceptions, previewMode = false, onClose, onSuccess,
}: Props) {
  const { t, fmt } = useI18n()
  const tz = fmt.timeZone
  const [date, setDate] = useState(() => todayInTz(tz))
  const [time, setTime] = useState('12:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPrice = lines.reduce((s, l) => s + l.qty * l.item.price, 0)

  const hours = useMemo(() => hoursOn(weeklyHours, hourExceptions), [weeklyHours, hourExceptions])
  const isException = hourExceptions.some(e => e.date === date)

  const windows = useMemo(
    () => sessionsFor(date, hours)
      .map(([a, b]) => [a + ORDER_BUFFER_MINUTES, b - ORDER_BUFFER_MINUTES] as [number, number])
      .filter(([a, b]) => b >= a),
    [date, hours],
  )
  const isOpenDay = windows.length > 0

  // Komponent montuje się przy każdym otwarciu okna, więc "teraz" jest świeże.
  const slots = useMemo(() => {
    const now = nowInTz(tz)
    const earliest = date === now.date ? now.minutes + ORDER_LEAD_MINUTES : 0
    const out = new Set<number>()
    for (const [a, b] of windows) {
      const start = Math.ceil(Math.max(a, earliest, 0) / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES
      for (let m = start; m <= Math.min(b, 1439); m += SLOT_STEP_MINUTES) out.add(m)
    }
    return [...out].sort((x, y) => x - y).map(fromMinutes)
  }, [windows, date, tz])

  useEffect(() => {
    if (!slots.includes(time)) setTime(slots[0] ?? '')
  }, [slots, time])

  const isTimeValid = slots.includes(time)
  const minDate = todayInTz(tz)
  const maxDate = addDays(minDate, 3)

  const handleSubmitOrder = async () => {
    if (lines.length === 0 || !authToken || previewMode) return
    if (!isOpenDay) { setError(t('checkout.closed_day')); return }
    if (!isTimeValid) { setError(t('checkout.pick_time')); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/orders/client/${cafeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          date,
          start_time: time,
          items: lines.map(l => ({
            menu_item_id: l.item.id, name: l.item.name, price: l.item.price, quantity: l.qty,
          })),
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || t('checkout.err'))
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('checkout.err'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor" style={{ maxWidth: 480 }}>
        <div className="me-header">
          <div>
            <div className="me-eyebrow">{t('checkout.eyebrow')}</div>
            <h2 className="me-title">{t('checkout.title')}</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label={t('common.close')}>✕</button>
        </div>

        <div className="me-body">
          {lines.map(l => (
            <div key={l.item.id} className="ord-item-row" style={{ fontSize: '0.9375rem', padding: '0.375rem 0' }}>
              <span className="ord-item-row__qty">{l.qty}×</span>
              <span className="ord-item-row__name">{l.item.name}</span>
              <span className="ord-item-row__price">{formatCurrency(l.item.price * l.qty, fmt)}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>{t('checkout.total')}</span><span>{formatCurrency(totalPrice, fmt)}</span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">{t('checkout.pickup_date')}</label>
              <input type="date" className="me-input" value={date} min={minDate} max={maxDate} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">{t('checkout.time')}</label>
              <select className="me-input" style={{ cursor: 'pointer' }} value={time}
                onChange={e => setTime(e.target.value)} disabled={slots.length === 0}>
                {slots.length === 0 && <option value="">{t('checkout.no_slots_option')}</option>}
                {slots.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {!isOpenDay ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginTop: '0.5rem' }}>
              {t('checkout.closed_day')}
            </p>
          ) : slots.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginTop: '0.5rem' }}>
              {t('checkout.no_slots_left')}
            </p>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {t(isException ? 'checkout.window_exception' : 'checkout.window', { from: slots[0], to: slots[slots.length - 1] })}
            </p>
          )}
          {differsFromBrowser(tz) && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {t('time.cafe_local', { offset: offsetLabel(tz) })}
            </p>
          )}

          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CreditCardIcon size={15} className="cp-inline-icon" /> {t('checkout.pay_on_site')}
          </p>

          {error && <div className="form-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
        </div>

        <div className="me-footer">
          <div className="me-footer-actions">
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>{t('common.cancel')}</button>
            <button type="button" className="btn btn--primary" style={{ width: 'auto', minWidth: 160 }}
              onClick={handleSubmitOrder} disabled={submitting || !isOpenDay || !isTimeValid}>
              {submitting ? t('checkout.submitting') : t('checkout.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
