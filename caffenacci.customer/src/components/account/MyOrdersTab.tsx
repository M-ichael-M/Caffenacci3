import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, ClipboardList, RefreshCw } from 'lucide-react'

type OrderStatusType = 'pending' | 'completed' | 'cancelled'

interface OrderItemOut {
  id: string
  menu_item_id: string | null
  name: string
  price: number
  quantity: number
}

interface ClientOrder {
  id: string
  cafe_id: string
  cafe_name: string
  client_nick: string
  date: string
  start_time: string
  items: OrderItemOut[]
  total_value: number
  status: OrderStatusType
  cancelled_by: string | null
  created_at: string | null
}

interface Props { token: string }

function money(n: number) { return `${n.toFixed(2)} zł` }

const CANCEL_DEADLINE_MS = 30 * 60 * 1000

function canCancel(o: ClientOrder): boolean {
  if (o.status !== 'pending') return false
  const start = new Date(`${o.date}T${o.start_time}:00`).getTime()
  return Date.now() <= start - CANCEL_DEADLINE_MS
}

function statusMeta(status: OrderStatusType): { label: string; cls: string } {
  if (status === 'pending') return { label: 'Oczekuje', cls: 'status-badge--pending' }
  if (status === 'completed') return { label: 'Zrealizowane', cls: 'status-badge--completed' }
  return { label: 'Anulowane', cls: 'status-badge--cancelled' }
}

function OrderItemsList({ items }: { items: OrderItemOut[] }) {
  return (
    <div className="ord-items">
      {items.map(it => (
        <div key={it.id} className="ord-item-row">
          <span className="ord-item-row__qty">{it.quantity}×</span>
          <span className="ord-item-row__name">{it.name}</span>
          <span className="ord-item-row__price">{money(it.price * it.quantity)}</span>
        </div>
      ))}
    </div>
  )
}

function OrderCard({ o, onCancel, cancelling }: { o: ClientOrder; onCancel: () => void; cancelling: boolean }) {
  const meta = statusMeta(o.status)
  return (
    <div className="entity-card">
      <div className="entity-card__body">
        <div className="entity-card__date">
          <div className="entity-card__date-day">{o.date.slice(8)}</div>
          <div className="entity-card__date-month">
            {new Date(o.date + 'T00:00:00').toLocaleDateString('pl-PL', { month: 'short' })}
          </div>
          <div className="entity-card__date-time">{o.start_time}</div>
        </div>

        <div className="entity-card__main">
          <div className="entity-card__header">
            <span className="entity-card__cafe">{o.cafe_name}</span>
            <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
            <span style={{
              background: 'rgba(169,114,47,0.1)', color: 'var(--gold)',
              borderRadius: 100, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700,
            }}>
              {money(o.total_value)}
            </span>
          </div>

          <OrderItemsList items={o.items} />

          {o.status === 'cancelled' && o.cancelled_by && (
            <div className="entity-card__sub" style={{ marginTop: '0.375rem', fontStyle: 'italic' }}>
              {o.cancelled_by === 'system'
                ? 'anulowane automatycznie — kawiarnia nie zrealizowała zamówienia w terminie'
                : `anulowane przez ${o.cancelled_by === 'owner' ? 'kawiarnię' : 'Ciebie'}`}
            </div>
          )}

          {o.status === 'pending' && (
            canCancel(o) ? (
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn--outline-dark btn--sm"
                  style={{ width: 'auto', color: 'var(--error)', borderColor: 'rgba(184,50,50,0.4)' }}
                  onClick={onCancel}
                  disabled={cancelling}
                >
                  {cancelling ? 'Anulowanie…' : 'Anuluj zamówienie'}
                </button>
              </div>
            ) : (
              <div className="entity-card__sub" style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
                Anulowanie było możliwe do 30 min przed godziną odbioru.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyOrdersTab({ token }: Props) {
  const [orders, setOrders] = useState<ClientOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSub, setActiveSub] = useState<'current' | 'history'>('current')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/orders/client/mine', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleCancel = async (o: ClientOrder) => {
    if (!confirm('Czy na pewno chcesz anulować to zamówienie?')) return
    setCancelError(null)
    setCancellingId(o.id)
    try {
      const res = await fetch(`http://localhost:8000/orders/client/${o.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Nie udało się anulować zamówienia.')
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: data.status, cancelled_by: data.cancelled_by } : x))
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Nie udało się anulować zamówienia.')
    } finally { setCancellingId(null) }
  }

  const current = orders
    .filter(o => o.status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))

  const history = orders
    .filter(o => o.status !== 'pending')
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Wczytywanie zamówień…</p>
      </div>
    )
  }

  const list = activeSub === 'current' ? current : history

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="page-header__eyebrow">Twoje konto</div>
          <h1 className="page-header__title" style={{ fontSize: '1.625rem' }}>Zamówienia</h1>
        </div>
        <button
          className="btn btn--outline-dark"
          style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={fetchAll}
        >
          <RefreshCw size={15} />
          Odśwież
        </button>
      </div>

      <div className="subtab-row">
        <button type="button" className={`subtab-btn${activeSub === 'current' ? ' subtab-btn--active' : ''}`} onClick={() => setActiveSub('current')}>
          Aktualne
          {current.length > 0 && <span className="subtab-badge">{current.length}</span>}
        </button>
        <button type="button" className={`subtab-btn${activeSub === 'history' ? ' subtab-btn--active' : ''}`} onClick={() => setActiveSub('history')}>
          Zrealizowane
          {history.length > 0 && <span className="subtab-badge subtab-badge--muted">{history.length}</span>}
        </button>
      </div>

      {cancelError && <div className="form-error" role="alert">{cancelError}</div>}

      {list.length === 0 ? (
        <div className="res-empty-card">
          <div className="res-empty-icon">
            {activeSub === 'current'
              ? <ShoppingCart size={44} strokeWidth={1.4} />
              : <ClipboardList size={44} strokeWidth={1.4} />}
          </div>
          <div className="res-empty-title">
            {activeSub === 'current' ? 'Brak oczekujących zamówień' : 'Brak historii zamówień'}
          </div>
          <div className="res-empty-sub">
            {activeSub === 'current'
              ? 'Twoje zamówienia we wszystkich kawiarniach pojawią się tutaj.'
              : 'Zrealizowane i anulowane zamówienia pojawią się tutaj.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {list.map(o => (
            <OrderCard
              key={o.id}
              o={o}
              onCancel={() => handleCancel(o)}
              cancelling={cancellingId === o.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}