import { useState, lazy, Suspense } from 'react'

const CheckoutModal = lazy(() => import('./CheckoutModal'))
const prefetchCheckout = () => { void import('./CheckoutModal') }

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
interface MenuSection { id: string; name: string; items: MenuItem[] }
interface CartLine { item: MenuItem; qty: number }

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

const PREVIEW_TITLE = 'Niedostępne w trybie podglądu.'
function money(n: number) { return `${n.toFixed(2)} zł` }

export default function MenuOrdering({
  cafeId, sections, ordersEnabled, requireLogin, authToken, weeklyHours, hourExceptions,
  previewMode = false,
}: Props) {
  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const addToCart = (item: MenuItem) => {
    if (item.is_unavailable || !ordersEnabled || previewMode) return
    prefetchCheckout()
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
            onMouseEnter={prefetchCheckout}
            onClick={() => requireLogin(() => setCheckoutOpen(true))}>
            Zamów →
          </button>
        </div>
      )}

      {checkoutOpen && (
        <Suspense fallback={null}>
          <CheckoutModal
            cafeId={cafeId}
            authToken={authToken}
            lines={lines}
            weeklyHours={weeklyHours}
            hourExceptions={hourExceptions}
            previewMode={previewMode}
            onClose={() => setCheckoutOpen(false)}
            onSuccess={() => {
              setCart({})
              setCheckoutOpen(false)
              setSuccess('Zamówienie zostało złożone! Zapłacisz na miejscu przy odbiorze.')
              setTimeout(() => setSuccess(null), 7000)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}