import { useState } from 'react'

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
}

function money(n: number) {
  return `${n.toFixed(2)} zł`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function MenuOrdering({ cafeId, sections, ordersEnabled, requireLogin, authToken }: Props) {
  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('12:00')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const addToCart = (item: MenuItem) => {
    if (item.is_unavailable || !ordersEnabled) return
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
    return d.toISOString().slice(0, 10)
  })()

  const handleSubmitOrder = async () => {
    if (lines.length === 0 || !authToken) return
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
                      <button type="button" className="cp-add-btn" onClick={() => addToCart(item)}>
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
          <div className="menu-editor" style={{ maxWidth: 480, height: 'auto', maxHeight: '88vh' }}>
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
                  <input type="time" className="me-input" value={time} onChange={e => setTime(e.target.value)} />
                </div>
              </div>

              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                💳 Płatność na miejscu — przy odbiorze zamówienia.
              </p>

              {error && <div className="form-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
            </div>

            <div className="me-footer">
              <div className="me-footer-actions">
                <button type="button" className="btn btn--outline-dark" onClick={() => setCheckoutOpen(false)}>Anuluj</button>
                <button type="button" className="btn btn--primary" style={{ width: 'auto', minWidth: 160 }}
                  onClick={handleSubmitOrder} disabled={submitting}>
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
