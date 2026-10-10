import { useState, useMemo, useEffect } from 'react'
import { CreditCardIcon } from './icons'

interface WeeklyHours { day_of_week: number; open_time: string | null; close_time: string | null }
interface HourException { date: string; is_closed: boolean; open_time: string | null; close_time: string | null }

interface MenuItem {
  id: string
  name: string
  description: string | null
  price: number
  is_vege: boolean
  is_hot: boolean
  is_unavailable: boolean
}

interface MenuSection {
  id: string
  name: string
  items: MenuItem[]
}

interface CartLine {
  item: MenuItem
  qty: number
}

interface Props {
  cafeId: string
  sections: MenuSection[]
  ordersEnabled: boolean
  requireLogin: (action: () => void) => void
  authToken: string | null
  weeklyHours: WeeklyHours[]
  hourExceptions: HourException[]
  previewMode?: boolean
}

const ORDER_BUFFER_MINUTES = 15
const ORDER_LEAD_MINUTES = 15
const SLOT_STEP_MINUTES = 15
const PREVIEW_TITLE = 'Niedostępne w trybie podglądu.'

function dayOfWeekFromDate(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getDay() + 6) % 7
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(m: number): string {
  const hh = String(Math.floor(m / 60) % 24).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
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
  const dow = dayOfWeekFromDate(dateStr)
  const plan = weeklyHours.find(h => h.day_of_week === dow)
  return { open: plan?.open_time ?? null, close: plan?.close_time ?? null, isException: false }
}

function money(n: number) {
  return `${n.toFixed(2)} zł`
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayStr() {
  return toLocalDateStr(new Date())
}

export default function MenuOrdering({
  cafeId, sections, ordersEnabled, requireLogin, authToken, weeklyHours, hourExceptions,
  previewMode = false,
}: Props) {
  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('12:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const effectiveHours = useMemo(
    () => getEffectiveHours(date, weeklyHours, hourExceptions),
    [date, weeklyHours, hourExceptions]
  )

  const orderWindow = useMemo(() => {
    if (!effectiveHours.open || !effectiveHours.close) return null
    const openM = toMinutes(effectiveHours.open) + ORDER_BUFFER_MINUTES
    const closeM = toMinutes(effectiveHours.close) - ORDER_BUFFER_MINUTES
    if (closeM <= openM) return null
    return { min: fromMinutes(openM), max: fromMinutes(closeM) }
  }, [effectiveHours])

  // Dostępne sloty co 15 min w oknie pracy; dla dzisiaj odcinamy to, co jest
  // wcześniejsze niż "teraz + 15 min". Przeliczane przy zmianie daty i przy
  // każdym otwarciu okna zamówienia, żeby godziny były aktualne.
  const slots = useMemo(() => {
    if (!orderWindow) return []
    const openM = toMinutes(orderWindow.min)
    const closeM = toMinutes(orderWindow.max)

    let start = openM
    if (date === todayStr()) {
      const now = new Date()
      start = Math.max(start, now.getHours() * 60 + now.getMinutes() + ORDER_LEAD_MINUTES)
    }
    // zaokrąglij w górę do pełnego kroku (np. 12:07 -> 12:15)
    start = Math.ceil(start / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES

    const result: string[] = []
    for (let m = start; m <= closeM; m += SLOT_STEP_MINUTES) result.push(fromMinutes(m))
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderWindow, date, checkoutOpen])

  // Jeśli wybrana godzina wypadła ze slotów (np. minął czas) — ustaw pierwszy wolny.
  useEffect(() => {
    if (!slots.includes(time)) setTime(slots[0] ?? '')
  }, [slots, time])

  const isTimeValid = slots.includes(time)

  const addToCart = (item: MenuItem) => {
    // Podgląd jest wyłącznie wizualny — nigdy nie dopuszczamy do żadnej
    // akcji, nawet gdyby przycisk poniżej nie był (z jakiegoś powodu) disabled.
    if (item.is_unavailable || !ordersEnabled || previewMode) return
    requireLogin(() => {
      setCart(prev => {
        const existing = prev[item.id]
        return { ...prev, [item.id]: { item, qty: (existing?.qty ?? 0) + 1 } }
      })
    })
  }

  const decFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev[itemId]
      if (!existing) return prev
      if (existing.qty <= 1) {
        const rest = { ...prev }
        delete rest[itemId]
        return rest
      }
      return { ...prev, [itemId]: { ...existing, qty: existing.qty - 1 } }
    })
  }

  const lines = Object.values(cart)
  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const totalPrice = lines.reduce((s, l) => s + l.qty * l.item.price, 0)

  const minDate = todayStr()
  const maxDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return toLocalDateStr(d)
  })()

  const handleSubmitOrder = async () => {
    if (lines.length === 0 || !authToken || previewMode) return
    if (!orderWindow) {
      setError('Kawiarnia jest zamknięta w wybranym dniu — wybierz inną datę.')
      return
    }
    if (!isTimeValid) {
      setError('Wybierz dostępną godzinę odbioru.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`http://localhost:8000/orders/client/${cafeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          date,
          start_time: time,
          items: lines.map(l => ({
            menu_item_id: l.item.id,
            name: l.item.name,
            price: l.item.price,
            quantity: l.qty,
          })),
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Błąd składania zamówienia.')
      }
      setCart({})
      setCheckoutOpen(false)
      setSuccess('Zamówienie zostało złożone! Zapłacisz na miejscu przy odbiorze.')
      setTimeout(() => setSuccess(null), 7000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Błąd składania zamówienia.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="cp-menu">
      {sections.map(sec => (
        <div key={sec.id} className="cp-menu-section">
          <h3 className="cp-menu-section__name">{sec.name}</h3>
          <div className="cp-menu-items">
            {sec.items.map(item => {
              const inCart = cart[item.id]?.qty ?? 0
              return (
                <div key={item.id} className={`cp-menu-item${item.is_unavailable ? ' cp-menu-item--unavailable' : ''}`}>
                  <div className="cp-menu-item__info">
                    <div className="cp-menu-item__name">
                      {item.name}
                      {item.is_vege && <span className="menu-badge menu-badge--vege">VEGE</span>}
                      {item.is_hot && <span className="menu-badge menu-badge--hot">HOT</span>}
                      {item.is_unavailable && <span className="menu-badge menu-badge--unavail">NIEDOSTĘPNE</span>}
                    </div>
                    {item.description && <div className="cp-menu-item__desc">{item.description}</div>}
                    <div className="cp-menu-item__price">{money(item.price)}</div>
                  </div>

                  {ordersEnabled && !item.is_unavailable && (
                    inCart > 0 ? (
                      <div className="cp-qty-stepper">
                        <button type="button" onClick={() => decFromCart(item.id)}>−</button>
                        <span>{inCart}</span>
                        <button type="button" onClick={() => addToCart(item)}>+</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="cp-add-btn"
                        onClick={() => addToCart(item)}
                        disabled={previewMode}
                        title={previewMode ? PREVIEW_TITLE : undefined}
                      >
                        + Dodaj do zamówienia
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {!ordersEnabled && (
        <p className="cp-muted-note">Ta kawiarnia nie przyjmuje obecnie zamówień online — zapraszamy na miejscu.</p>
      )}

      {success && <div className="form-success" style={{ marginTop: '1rem' }}>{success}</div>}

      {ordersEnabled && totalQty > 0 && (
        <div className="cp-cart-bar">
          <span>{totalQty} {totalQty === 1 ? 'pozycja' : 'pozycji'} · {money(totalPrice)}</span>
          <button type="button" className="btn btn--primary" style={{ width: 'auto', marginTop: 0 }}
            onClick={() => requireLogin(() => setCheckoutOpen(true))}>
            Zamów →
          </button>
        </div>
      )}

      {checkoutOpen && (
        <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) setCheckoutOpen(false) }}>
          <div className="menu-editor" style={{ maxWidth: 480 }}>
            <div className="me-header">
              <div>
                <div className="me-eyebrow">Podsumowanie</div>
                <h2 className="me-title">Twoje zamówienie</h2>
              </div>
              <button className="me-close" type="button" onClick={() => setCheckoutOpen(false)}>✕</button>
            </div>

            <div className="me-body">
              {lines.map(l => (
                <div key={l.item.id} className="ord-item-row" style={{ fontSize: '0.9375rem', padding: '0.375rem 0' }}>
                  <span className="ord-item-row__qty">{l.qty}×</span>
                  <span className="ord-item-row__name">{l.item.name}</span>
                  <span className="ord-item-row__price">{money(l.item.price * l.qty)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Razem</span><span>{money(totalPrice)}</span>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem' }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="me-label">Data odbioru</label>
                  <input type="date" className="me-input" value={date} min={minDate} max={maxDate} onChange={e => setDate(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="me-label">Godzina</label>
                  <select
                    className="me-input"
                    style={{ cursor: 'pointer' }}
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    disabled={slots.length === 0}
                  >
                    {slots.length === 0 && <option value="">Brak godzin</option>}
                    {slots.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {!orderWindow ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginTop: '0.5rem' }}>
                  Kawiarnia jest zamknięta w wybranym dniu — wybierz inną datę.
                </p>
              ) : slots.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginTop: '0.5rem' }}>
                  Na ten dzień nie ma już wolnych godzin odbioru — wybierz inną datę.
                </p>
              ) : (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Zamówienia na ten dzień przyjmujemy od {slots[0]} do {slots[slots.length - 1]}
                  {effectiveHours.isException ? ' (dzień wyjątkowy w godzinach pracy)' : ''}.
                </p>
              )}

              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CreditCardIcon size={15} className="cp-inline-icon" /> Płatność na miejscu — przy odbiorze zamówienia.
              </p>

              {error && <div className="form-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
            </div>

            <div className="me-footer">
              <div className="me-footer-actions">
                <button type="button" className="btn btn--outline-dark" onClick={() => setCheckoutOpen(false)}>Anuluj</button>
                <button type="button" className="btn btn--primary" style={{ width: 'auto', minWidth: 160 }}
                  onClick={handleSubmitOrder} disabled={submitting || !orderWindow || !isTimeValid}>
                  {submitting ? 'Składanie…' : 'Złóż zamówienie'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}