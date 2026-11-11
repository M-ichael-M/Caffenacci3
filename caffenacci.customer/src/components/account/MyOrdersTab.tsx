import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, ClipboardList, RefreshCw } from 'lucide-react'
import { API_URL } from '../../config'
import { useI18n } from '../../i18n/I18nProvider'
import { formatCurrency, formatDate, type LocaleFormat } from '../../i18n/localeFormat'
import type { TFunction } from '../../i18n/system'
import { wallToEpoch } from '../../utils/cafeTime'

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
  time_zone?: string
  items: OrderItemOut[]
  total_value: number
  status: OrderStatusType
  cancelled_by: string | null
  created_at: string | null
}

interface Props { token: string }

const CANCEL_DEADLINE_MS = 30 * 60 * 1000

function canCancel(o: ClientOrder): boolean {
  if (o.status !== 'pending') return false
  const start = wallToEpoch(o.date, o.start_time, o.time_zone ?? 'Europe/Warsaw')
  return Date.now() <= start - CANCEL_DEADLINE_MS
}

function statusMeta(status: OrderStatusType, t: TFunction): { label: string; cls: string } {
  if (status === 'pending') return { label: t('ord.pending'), cls: 'status-badge--pending' }
  if (status === 'completed') return { label: t('ord.completed'), cls: 'status-badge--completed' }
  return { label: t('ord.cancelled'), cls: 'status-badge--cancelled' }
}

function OrderItemsList({ items, fmt }: { items: OrderItemOut[]; fmt: LocaleFormat }) {
  return (
    <div className="ord-items">
      {items.map(it => (
        <div key={it.id} className="ord-item-row">
          <span className="ord-item-row__qty">{it.quantity}×</span>
          <span className="ord-item-row__name">{it.name}</span>
          <span className="ord-item-row__price">{formatCurrency(it.price * it.quantity, fmt)}</span>
        </div>
      ))}
    </div>
  )
}

function OrderCard({ o, onCancel, cancelling }: { o: ClientOrder; onCancel: () => void; cancelling: boolean }) {
  const { t, fmt } = useI18n()
  const meta = statusMeta(o.status, t)
  return (
    <div className="entity-card">
      <div className="entity-card__body">
        <div className="entity-card__date">
          <div className="entity-card__date-day">{o.date.slice(8)}</div>
          <div className="entity-card__date-month">{formatDate(o.date, fmt, { month: 'short' })}</div>
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
              {formatCurrency(o.total_value, fmt)}
            </span>
          </div>

          <OrderItemsList items={o.items} fmt={fmt} />

          {o.status === 'cancelled' && o.cancelled_by && (
            <div className="entity-card__sub" style={{ marginTop: '0.375rem', fontStyle: 'italic' }}>
              {o.cancelled_by === 'system'
                ? t('ord.cancelled_system')
                : o.cancelled_by === 'owner' ? t('ord.cancelled_owner') : t('ord.cancelled_you')}
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
                  {cancelling ? t('ord.cancelling') : t('ord.cancel')}
                </button>
              </div>
            ) : (
              <div className="entity-card__sub" style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
                {t('ord.cancel_window')}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyOrdersTab({ token }: Props) {
  const { t } = useI18n()
  const [orders, setOrders] = useState<ClientOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSub, setActiveSub] = useState<'current' | 'history'>('current')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/orders/client/mine`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleCancel = async (o: ClientOrder) => {
    if (!confirm(t('ord.confirm'))) return
    setCancelError(null)
    setCancellingId(o.id)
    try {
      const res = await fetch(`${API_URL}/orders/client/${o.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : t('ord.err_cancel'))
      setOrders(prev => prev.map(x => x.id === o.id ? { ...x, status: data.status, cancelled_by: data.cancelled_by } : x))
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : t('ord.err_cancel'))
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
        <p>{t('ord.loading')}</p>
      </div>
    )
  }

  const list = activeSub === 'current' ? current : history

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="page-header__eyebrow">{t('acc.eyebrow')}</div>
          <h1 className="page-header__title" style={{ fontSize: '1.625rem' }}>{t('ord.title')}</h1>
        </div>
        <button
          className="btn btn--outline-dark"
          style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          onClick={fetchAll}
        >
          <RefreshCw size={15} />
          {t('acc.refresh')}
        </button>
      </div>

      <div className="subtab-row">
        <button type="button" className={`subtab-btn${activeSub === 'current' ? ' subtab-btn--active' : ''}`} onClick={() => setActiveSub('current')}>
          {t('ord.tab_current')}
          {current.length > 0 && <span className="subtab-badge">{current.length}</span>}
        </button>
        <button type="button" className={`subtab-btn${activeSub === 'history' ? ' subtab-btn--active' : ''}`} onClick={() => setActiveSub('history')}>
          {t('ord.tab_history')}
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
            {activeSub === 'current' ? t('ord.empty_current') : t('ord.empty_history')}
          </div>
          <div className="res-empty-sub">
            {activeSub === 'current' ? t('ord.empty_current_sub') : t('ord.empty_history_sub')}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {list.map(o => (
            <OrderCard key={o.id} o={o} onCancel={() => handleCancel(o)} cancelling={cancellingId === o.id} />
          ))}
        </div>
      )}
    </div>
  )
}
