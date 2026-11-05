import { useState, useMemo, useEffect } from 'react'
import { CreditCardIcon } from './icons'
import { API_URL } from '../../config'
import { useI18n } from '../../i18n/I18nProvider'
import { formatCurrency } from '../../i18n/localeFormat'
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

function dayOfWeekFromDate(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getDay() + 6) % 7
}
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function fromMinutes(m: number): string {
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function getEffectiveHours(dateStr: string, weeklyHours: WeeklyHours[], hourExceptions: HourException[]) {
  const exception = hourExceptions.find(e => e.date === dateStr)
  if (exception) {
    return {
      open: exception.is_closed ? null : exception.open_time,
      close: exception.is_closed ? null : exception.close_time,
      isException: true,
    }
  }
  const plan = weeklyHours.find(h => h.day_of_week === dayOfWeekFromDate(dateStr))
  return { open: plan?.open_time ?? null, close: plan?.close_time ?? null, isException: false }
}
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayStr() { return toLocalDateStr(new Date()) }

export default function CheckoutModal({
  cafeId, authToken, lines, weeklyHours, hourExceptions, previewMode = false, onClose, onSuccess,
}: Props) {
  const { t, fmt } = useI18n()
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('12:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPrice = lines.reduce((s, l) => s + l.qty * l.item.price, 0)

  const effectiveHours = useMemo(
    () => getEffectiveHours(date, weeklyHours, hourExceptions),
    [date, weeklyHours, hourExceptions],
  )

  const orderWindow = useMemo(() => {
    if (!effectiveHours.open || !effectiveHours.close) return null
    const openM = toMinutes(effectiveHours.open) + ORDER_BUFFER_MINUTES
    const closeM = toMinutes(effectiveHours.close) - ORDER_BUFFER_MINUTES
    if (closeM <= openM) return null
    return { min: fromMinutes(openM), max: fromMinutes(closeM) }
  }, [effectiveHours])

  // Komponent montuje się przy każdym otwarciu okna, więc "teraz" jest zawsze świeże.
  const slots = useMemo(() => {
    if (!orderWindow) return []
    const openM = toMinutes(orderWindow.min)
    const closeM = toMinutes(orderWindow.max)
    let start = openM
    if (date === todayStr()) {
      const now = new Date()
      start = Math.max(start, now.getHours() * 60 + now.getMinutes() + ORDER_LEAD_MINUTES)
    }
    start = Math.ceil(start / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES
    const result: string[] = []
    for (let m = start; m <= closeM; m += SLOT_STEP_MINUTES) result.push(fromMinutes(m))
    return result
  }, [orderWindow, date])

  useEffect(() => {
    if (!slots.includes(time)) setTime(slots[0] ?? '')
  }, [slots, time])

  const isTimeValid = slots.includes(time)
  const minDate = todayStr()
  const maxDate = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return toLocalDateStr(d) })()

  const handleSubmitOrder = async () => {
    if (lines.length === 0 || !authToken || previewMode) return
    if (!orderWindow) { setError(t('checkout.closed_day')); return }
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

          {!orderWindow ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginTop: '0.5rem' }}>
              {t('checkout.closed_day')}
            </p>
          ) : slots.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginTop: '0.5rem' }}>
              {t('checkout.no_slots_left')}
            </p>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {t(effectiveHours.isException ? 'checkout.window_exception' : 'checkout.window', { from: slots[0], to: slots[slots.length - 1] })}
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
              onClick={handleSubmitOrder} disabled={submitting || !orderWindow || !isTimeValid}>
              {submitting ? t('checkout.submitting') : t('checkout.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}