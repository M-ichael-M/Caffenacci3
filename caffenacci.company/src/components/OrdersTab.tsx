import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, ClipboardList, Check, X, RefreshCw } from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'
import { useCafeSettings } from './CafeSettingsContext'
import { formatMoney } from '../utils/currency'
import { parseUtc } from '../utils/cafeTime'

// ── Types ─────────────────────────────────────────────────────────────────

type OrderStatusType = 'pending' | 'completed' | 'cancelled'

interface OrderItemOut {
  id: string
  menu_item_id: string | null
  name: string
  price: number
  quantity: number
}

interface OrderOut {
  id: string
  cafe_id: string
  client_nick: string
  date: string
  start_time: string
  items: OrderItemOut[]
  total_value: number
  currency: string
  status: OrderStatusType
  cancelled_by: string | null
  created_at: string | null
}

interface OrderSettingsOut {
  id: string
  cafe_id: string
  enabled: boolean
}

interface Props {
  token: string
  cafeId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(ds: string, locale: string) {
  const d = new Date(ds + 'T00:00:00')
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatCreatedAt(s: string | null, locale: string, tz: string) {
  if (!s) return ''
  return parseUtc(s).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz })
}

// ── Toggle (spójny z resztą aplikacji) ───────────────────────────────────

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--espresso)' : 'var(--border)',
        opacity: disabled ? 0.5 : 1,
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: checked ? 'var(--gold-soft)' : '#fff',
        transition: 'left 0.2s, background 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

// ── Order item list (produkty w zamówieniu) ──────────────────────────────

function OrderItemsList({ items, currency }: { items: OrderItemOut[]; currency: string }) {
  const { locale } = useI18n()
  return (
    <div className="ord-items">
      {items.map(it => (
        <div key={it.id} className="ord-item-row">
          <span className="ord-item-row__qty">{it.quantity}×</span>
          {/* Nazwa pozycji pochodzi z menu właściciela — nie tłumaczymy jej */}
          <span className="ord-item-row__name" translate="no">{it.name}</span>
          <span className="ord-item-row__price">{formatMoney(it.price * it.quantity, locale, currency)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Pending order card ─────────────────────────────────────────────────

function PendingOrderCard({ o, onDecide, saving }: {
  o: OrderOut
  onDecide: (o: OrderOut, status: 'completed' | 'cancelled') => void
  saving: boolean
}) {
  const { t, locale } = useI18n()
  const { timeZone } = useCafeSettings()
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border-soft)',
      borderLeft: '3px solid var(--gold)', borderRadius: 'var(--radius-md)', overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {/* Data / godzina */}
        <div style={{
          flexShrink: 0, background: 'var(--sidebar-bg)', borderRadius: 'var(--radius-sm)',
          padding: '0.625rem 0.875rem', textAlign: 'center', minWidth: 64,
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif", fontSize: '1.375rem',
            fontWeight: 600, color: 'var(--gold-soft)', lineHeight: 1,
          }}>
            {o.date.slice(8)}
          </div>
          <div style={{
            fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em',
            color: 'rgba(240,228,204,0.6)', textTransform: 'uppercase', marginTop: '0.25rem',
          }}>
            {new Date(o.date + 'T00:00:00').toLocaleDateString(locale, { month: 'short' })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--parchment)', marginTop: '0.375rem', fontWeight: 600 }}>
            {o.start_time}
          </div>
        </div>

        {/* Główne info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-dark)' }} translate="no">
              {o.client_nick}
            </span>
            <span style={{
              background: 'rgba(169,114,47,0.1)', color: 'var(--gold)',
              borderRadius: 100, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700,
            }}>
              {formatMoney(o.total_value, locale, o.currency)}
            </span>
          </div>

          <OrderItemsList items={o.items} currency={o.currency} />

          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {t('orders.placedAt', { time: formatCreatedAt(o.created_at, locale, timeZone) })}
          </div>
        </div>
      </div>

      {/* Akcje */}
      <div style={{
        borderTop: '1px solid var(--border-soft)', padding: '0.75rem 1.25rem',
        display: 'flex', justifyContent: 'flex-end', gap: '0.625rem',
        background: 'var(--surface-2)',
      }}>
        <button
          type="button"
          onClick={() => onDecide(o, 'cancelled')}
          disabled={saving}
          style={{
            appearance: 'none', background: 'transparent',
            border: '1.5px solid rgba(178,59,59,0.35)', color: 'var(--error)',
            borderRadius: 'var(--radius-sm)', padding: '0.5rem 1rem', fontSize: '0.8125rem',
            fontFamily: 'inherit', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {t('orders.action.cancel')}
        </button>
        <button
          type="button"
          onClick={() => onDecide(o, 'completed')}
          disabled={saving}
          className="btn btn--primary"
          style={{ width: 'auto', padding: '0.5rem 1.125rem', fontSize: '0.8125rem', marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <Check size={16} />
          {t('orders.action.complete')}
        </button>
      </div>
    </div>
  )
}

// ── History order card ────────────────────────────────────────────────

function HistoryOrderCard({ o }: { o: OrderOut }) {
  const { t, locale } = useI18n()
  const isCompleted = o.status === 'completed'

  const cancelledLabel = !isCompleted && o.cancelled_by
    ? (o.cancelled_by === 'system' ? t('orders.cancelledBy.system')
      : o.cancelled_by === 'owner' ? t('orders.cancelledBy.owner')
      : t('orders.cancelledBy.client'))
    : null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border-soft)',
      borderLeft: `3px solid ${isCompleted ? 'var(--success)' : 'var(--error)'}`,
      borderRadius: 'var(--radius-md)', padding: '0.875rem 1.25rem',
      display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
      opacity: isCompleted ? 1 : 0.75,
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ flexShrink: 0, paddingTop: '0.125rem' }}>
        {isCompleted ? (
          <Check size={24} color="var(--success)" />
        ) : (
          <X size={24} color="var(--error)" />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.9375rem' }} translate="no">
            {o.client_nick}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {t('orders.dateAt', { date: formatDate(o.date, locale), time: o.start_time })}
          </span>
          <span style={{
            background: 'var(--border-soft)', color: 'var(--text-muted)',
            borderRadius: 100, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 600,
          }}>
            {formatMoney(o.total_value, locale, o.currency)}
          </span>
          {cancelledLabel && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {cancelledLabel}
            </span>
          )}
        </div>
        <OrderItemsList items={o.items} currency={o.currency} />
      </div>
    </div>
  )
}

// ── Modal: potwierdzenie realizacji kodem klienta ──────────────────────

function CompleteOrderModal({ order, onClose, onSubmit }: {
  order: OrderOut
  onClose: () => void
  onSubmit: (code: string) => Promise<string | null>
}) {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (code.length !== 8) { setError(t('orders.modal.errLength')); return }
    setBusy(true)
    const err = await onSubmit(code)
    setBusy(false)
    if (err) setError(err)
  }

  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="menu-editor" style={{ maxWidth: 440, height: 'auto' }}>
        <div className="me-header">
          <div>
            <div className="me-eyebrow">{t('orders.modal.eyebrow')}</div>
            <h2 className="me-title" translate="no">{order.client_nick}</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label={t('common.close')}><X size={16} /></button>
        </div>
        <div className="me-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            {t('orders.modal.intro')}
          </p>
          <div className="field">
            <label className="me-label">{t('orders.modal.codeLabel')}</label>
            <input
              className="me-input"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              maxLength={8}
              placeholder={t('orders.modal.codePlaceholder')}
              autoFocus
              style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'monospace' }}
            />
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>
        <div className="me-footer">
          <div className="me-footer-actions">
            <button type="button" className="btn btn--outline-dark" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
            <button type="button" className="btn btn--primary" style={{ width: 'auto', minWidth: 160 }}
              onClick={handleSubmit} disabled={busy || code.length !== 8}>
              {busy ? t('orders.modal.checking') : t('orders.modal.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function OrdersTab({ token }: Props) {
  const { t, tApi } = useI18n()
  const [settings, setSettings]       = useState<OrderSettingsOut | null>(null)
  const [settingsSaving, setSettingsSaving] = useState(false)

  const [pending, setPending]   = useState<OrderOut[]>([])
  const [history, setHistory]   = useState<OrderOut[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)  // id zamówienia w trakcie zapisu
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [completing, setCompleting] = useState<OrderOut | null>(null)

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/orders/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setSettings(await res.json())
    } catch { /* ignore */ }
  }, [token])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        const all: OrderOut[] = data.orders ?? []
        setPending(all.filter(o => o.status === 'pending'))
        setHistory(all.filter(o => o.status !== 'pending'))
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchSettings(); fetchOrders() }, [fetchSettings, fetchOrders])

  // ── Toggle ustawień ───────────────────────────────────────────────────

  const handleToggleEnabled = async (enabled: boolean) => {
    setSettingsSaving(true)
    try {
      const res = await fetch(`${API_URL}/orders/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled }),
      })
      if (res.ok) setSettings(await res.json())
    } catch { /* ignore */ }
    finally { setSettingsSaving(false) }
  }

  // ── Decyzja o zamówieniu ─────────────────────────────────────────────

  const handleDecide = async (o: OrderOut, newStatus: 'completed' | 'cancelled') => {
    setSaving(o.id)
    try {
      const res = await fetch(`${API_URL}/orders/${o.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error()
      const updated: OrderOut = await res.json()
      setPending(prev => prev.filter(x => x.id !== updated.id))
      setHistory(prev => [updated, ...prev])
    } catch { /* ignore */ }
    finally { setSaving(null) }
  }

  const handleComplete = async (code: string): Promise<string | null> => {
    if (!completing) return null
    setSaving(completing.id)
    try {
      const res = await fetch(`${API_URL}/orders/${completing.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'completed', loyalty_code: code }),
      })
      const data = await res.json()
      if (!res.ok) return tApi(data.detail, 'orders.err.generic')
      const updated: OrderOut = data
      setPending(prev => prev.filter(x => x.id !== updated.id))
      setHistory(prev => [updated, ...prev])
      setCompleting(null)
      return null
    } catch {
      return t('common.genericError')
    } finally { setSaving(null) }
  }

  // ── Render ────────────────────────────────────────────────────────────

  const tabStyle = (active: boolean): React.CSSProperties => ({
    appearance: 'none' as const, background: 'none', border: 'none',
    borderBottom: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
    color: active ? 'var(--text-dark)' : 'var(--text-muted)',
    fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: active ? 600 : 400,
    padding: '0.625rem 0', marginRight: '1.5rem', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '0.375rem',
  })

  const badgeStyle = (color: string): React.CSSProperties => ({
    background: color, borderRadius: 100, padding: '1px 7px',
    fontSize: '0.6875rem', fontWeight: 700, color: '#fff', lineHeight: '1.6',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {completing && (
        <CompleteOrderModal order={completing} onClose={() => setCompleting(null)} onSubmit={handleComplete} />
      )}

      {/* ── Nagłówek ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="page-header__eyebrow" style={{ marginBottom: '0.375rem' }}>
            {t('common.management')}
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
            {t('orders.title')}
          </h2>
        </div>
        <button className="btn btn--outline-dark" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={fetchOrders}>
          <RefreshCw size={15} />
          {t('common.refresh')}
        </button>
      </div>

      {/* ── Toggle: przyjmowanie zamówień ────────────────────────────── */}
      <div className="res-settings-block" style={{ margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-dark)' }}>
              {t('orders.accept.title')}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
              {t('orders.accept.hint')}
            </div>
          </div>
          <Toggle
            checked={settings?.enabled ?? false}
            onChange={handleToggleEnabled}
            disabled={settingsSaving || !settings}
          />
        </div>
      </div>


      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>{t('orders.loading')}</p>
        </div>
      ) : (
        <>
          {/* ── Tabs ─────────────────────────────────────────────────── */}
          <div style={{ borderBottom: '1px solid var(--border)' }}>
            <button type="button" style={tabStyle(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>
              {t('orders.tab.pending')}
              {pending.length > 0 && <span style={badgeStyle('var(--gold)')}>{pending.length}</span>}
            </button>
            <button type="button" style={tabStyle(activeTab === 'history')} onClick={() => setActiveTab('history')}>
              {t('orders.tab.history')}
              {history.length > 0 && <span style={badgeStyle('var(--text-muted)')}>{history.length}</span>}
            </button>
          </div>

          {/* ── Pending ─────────────────────────────────────────────── */}
          {activeTab === 'pending' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {pending.length === 0 ? (
                <div className="res-empty-card">
                  <div className="res-empty-icon">
                    <ShoppingCart size={44} strokeWidth={1.4} />
                  </div>
                  <div className="res-empty-title">{t('orders.empty.pending.title')}</div>
                  <div className="res-empty-sub">{t('orders.empty.pending.sub')}</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    {t('orders.pending.count', { count: pending.length })}
                  </div>
                  {pending
                    .slice()
                    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
                    .map(o => (
                      <PendingOrderCard key={o.id} o={o} saving={saving === o.id}
                        onDecide={(ord, st) => st === 'completed' ? setCompleting(ord) : handleDecide(ord, st)} />
                    ))}
                </>
              )}
            </div>
          )}

          {/* ── History ─────────────────────────────────────────────── */}
          {activeTab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {history.length === 0 ? (
                <div className="res-empty-card">
                  <div className="res-empty-icon">
                    <ClipboardList size={44} strokeWidth={1.4} />
                  </div>
                  <div className="res-empty-title">{t('orders.empty.history.title')}</div>
                  <div className="res-empty-sub">{t('orders.empty.history.sub')}</div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {t('orders.history.summary', {
                      completed: history.filter(o => o.status === 'completed').length,
                      cancelled: history.filter(o => o.status === 'cancelled').length,
                    })}
                  </div>
                  {history
                    .slice()
                    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
                    .map(o => <HistoryOrderCard key={o.id} o={o} />)}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
