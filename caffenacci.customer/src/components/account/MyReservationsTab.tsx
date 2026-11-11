import { useState, useEffect, useCallback } from 'react'
import { CalendarDays, Users, X, RefreshCw, ArrowRight } from 'lucide-react'
import { API_URL } from '../../config'
import { useI18n } from '../../i18n/I18nProvider'
import { formatDate, type LocaleFormat } from '../../i18n/localeFormat'
import type { TFunction } from '../../i18n/system'
import { wallToEpoch } from '../../utils/cafeTime'

type ResStatus = 'pending' | 'confirmed' | 'cancelled'

interface ClientReservation {
  id: string
  table_id: string | null
  cafe_id: string
  cafe_name: string
  is_advanced: boolean
  date: string
  start_time: string
  time_zone?: string
  guests: number
  guest_name: string
  guest_phone: string | null
  guest_email: string | null
  comment: string | null
  client_id: string | null
  created_by_owner: boolean
  status: ResStatus
  owner_note: string | null
  created_at: string | null
  table_seats: number | null
  table_type: string | null
  table_label: string | null
  cancelled_by: string | null
}

interface Props { token: string }

function dayLabel(ds: string, fmt: LocaleFormat) {
  return formatDate(ds, fmt, { weekday: 'short', day: 'numeric', month: 'short' })
}

function startTimestamp(r: ClientReservation): number {
  return wallToEpoch(r.date, r.start_time, r.time_zone ?? 'Europe/Warsaw')
}

// Rezerwacja "przenosi się" do historii godzinę po planowanym terminie.
function isPast(r: ClientReservation): boolean {
  return startTimestamp(r) + 60 * 60 * 1000 < Date.now()
}

const CANCEL_DEADLINE_MS = 30 * 60 * 1000

function canCancel(r: ClientReservation): boolean {
  return r.status !== 'cancelled' && Date.now() <= startTimestamp(r) - CANCEL_DEADLINE_MS
}

function statusMeta(r: ClientReservation, t: TFunction): { label: string; cls: string } {
  if (r.status === 'cancelled') {
    if (r.cancelled_by === 'client') return { label: t('resv.s_cancelled_you'), cls: 'status-badge--cancelled' }
    if (r.cancelled_by === 'owner')  return { label: t('resv.s_cancelled_cafe'), cls: 'status-badge--cancelled' }
    return { label: t('resv.s_rejected'), cls: 'status-badge--cancelled' }
  }
  if (r.is_advanced) return { label: t('resv.s_confirmed'), cls: 'status-badge--confirmed' }
  if (r.status === 'pending') return { label: t('resv.s_pending'), cls: 'status-badge--pending' }
  return { label: t('resv.s_confirmed'), cls: 'status-badge--confirmed' }
}

function tableDescription(r: ClientReservation, t: TFunction): string {
  if (!r.table_type) return ''
  const key = `resv.type.${r.table_type}`
  const base = t.has(key) ? t(key) : r.table_type
  if (r.table_label) return t('resv.table_label', { base, label: r.table_label })
  if (r.table_seats) return t('resv.table_seats', { base, seats: r.table_seats })
  return base
}

function ReservationCard({ r, onClick, onCancel, cancelling }: {
  r: ClientReservation; onClick?: () => void; onCancel?: () => void; cancelling?: boolean
}) {
  const { t, fmt } = useI18n()
  const meta = statusMeta(r, t)
  const clickable = !!onClick
  const tableDesc = tableDescription(r, t)

  return (
    <div
      className={`entity-card${clickable ? ' entity-card--clickable' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="entity-card__body">
        <div className="entity-card__date">
          <div className="entity-card__date-day">{r.date.slice(8)}</div>
          <div className="entity-card__date-month">{formatDate(r.date, fmt, { month: 'short' })}</div>
          <div className="entity-card__date-time">{r.start_time}</div>
        </div>

        <div className="entity-card__main">
          <div className="entity-card__header">
            <span className="entity-card__cafe">{r.cafe_name}</span>
            <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
          </div>

          <div className="entity-card__sub">
            <Users size={13} />
            {t('resv.guests', { count: r.guests })}
            {tableDesc && <> · {tableDesc}</>}
            {r.is_advanced && <> · {t('resv.advanced')}</>}
          </div>

          {(r.guest_phone || r.guest_email) && (
            <div className="entity-card__sub" style={{ marginTop: '0.25rem' }}>
              {r.guest_phone}{r.guest_phone && r.guest_email ? ' · ' : ''}{r.guest_email}
            </div>
          )}

          {r.comment && (
            <div className="entity-card__sub" style={{ marginTop: '0.25rem', fontStyle: 'italic' }}>
              „{r.comment}”
            </div>
          )}

          {r.status !== 'cancelled' && !isPast(r) && (
            canCancel(r) ? (
              <div style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn--outline-dark btn--sm"
                  style={{ width: 'auto', color: 'var(--error)', borderColor: 'rgba(184,50,50,0.4)' }}
                  onClick={e => { e.stopPropagation(); onCancel?.() }}
                  disabled={cancelling}
                >
                  {cancelling ? t('ord.cancelling') : t('resv.cancel')}
                </button>
              </div>
            ) : (
              <div className="entity-card__sub" style={{ marginTop: '0.5rem', fontStyle: 'italic' }}>
                {t('resv.cancel_window')}
              </div>
            )
          )}

          {clickable && (
            <div className="entity-card__hint">
              {t('resv.hint')} <ArrowRight size={12} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReservationDetailModal({ r, onClose }: { r: ClientReservation; onClose: () => void }) {
  const { t, fmt } = useI18n()
  const meta = statusMeta(r, t)
  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor" style={{ height: 'auto', maxHeight: '90vh' }}>
        <div className="me-header">
          <div>
            <div className="me-eyebrow">{r.cafe_name}</div>
            <h2 className="me-title">{t('resv.modal_title', { date: dayLabel(r.date, fmt) })}</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label={t('acc.close')}><X size={16} /></button>
        </div>

        <div className="me-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="res-table-row">
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                <CalendarDays size={15} />
                {t('resv.date_at', { date: dayLabel(r.date, fmt), time: r.start_time })}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                <Users size={15} />
                {t('resv.guests', { count: r.guests })}
              </span>
            </div>
            <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
            {r.comment && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-body)', fontStyle: 'italic', marginTop: '0.75rem' }}>
                {t('resv.your_comment', { comment: r.comment })}
              </div>
            )}
          </div>

          <div>
            <label className="me-label">{t('resv.cafe_msg')}</label>
            {r.owner_note ? (
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-dark)', lineHeight: 1.6 }}>{r.owner_note}</p>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('resv.no_msg')}</p>
            )}
          </div>
        </div>

        <div className="me-footer">
          <button type="button" className="btn btn--outline-dark" onClick={onClose}>{t('acc.close')}</button>
        </div>
      </div>
    </div>
  )
}

export default function MyReservationsTab({ token }: Props) {
  const { t } = useI18n()
  const [reservations, setReservations] = useState<ClientReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSub, setActiveSub] = useState<'current' | 'history'>('current')
  const [detail, setDetail] = useState<ClientReservation | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/reservations/client/mine`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setReservations(data.reservations ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleCancel = async (r: ClientReservation) => {
    if (!confirm(t('resv.confirm'))) return
    setCancelError(null)
    setCancellingId(r.id)
    try {
      const res = await fetch(`${API_URL}/reservations/client/${r.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : t('resv.err_cancel'))
      setReservations(prev => prev.map(x => x.id === r.id ? { ...x, status: data.status, cancelled_by: data.cancelled_by } : x))
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : t('resv.err_cancel'))
    } finally { setCancellingId(null) }
  }

  const current = reservations
    .filter(r => !isPast(r) && r.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))

  const history = reservations
    .filter(r => isPast(r) || r.status === 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time))

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>{t('resv.loading')}</p>
      </div>
    )
  }

  const list = activeSub === 'current' ? current : history

  return (
    <>
      {detail && <ReservationDetailModal r={detail} onClose={() => setDetail(null)} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="page-header__eyebrow">{t('acc.eyebrow')}</div>
            <h1 className="page-header__title" style={{ fontSize: '1.625rem' }}>{t('resv.title')}</h1>
          </div>
          <button className="btn btn--outline-dark" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={fetchAll}>
            <RefreshCw size={15} />
            {t('acc.refresh')}
          </button>
        </div>

        <div className="subtab-row">
          <button type="button" className={`subtab-btn${activeSub === 'current' ? ' subtab-btn--active' : ''}`} onClick={() => setActiveSub('current')}>
            {t('resv.tab_current')}
            {current.length > 0 && <span className="subtab-badge">{current.length}</span>}
          </button>
          <button type="button" className={`subtab-btn${activeSub === 'history' ? ' subtab-btn--active' : ''}`} onClick={() => setActiveSub('history')}>
            {t('resv.tab_history')}
            {history.length > 0 && <span className="subtab-badge subtab-badge--muted">{history.length}</span>}
          </button>
        </div>

        {cancelError && <div className="form-error" role="alert">{cancelError}</div>}

        {list.length === 0 ? (
          <div className="res-empty-card">
            <div className="res-empty-icon"><CalendarDays size={44} strokeWidth={1.4} /></div>
            <div className="res-empty-title">
              {activeSub === 'current' ? t('resv.empty_current') : t('resv.empty_history')}
            </div>
            <div className="res-empty-sub">
              {activeSub === 'current' ? t('resv.empty_current_sub') : t('resv.empty_history_sub')}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {list.map(r => {
              const clickableDetail = !r.is_advanced && !r.cancelled_by && (r.status === 'confirmed' || r.status === 'cancelled')
              return (
                <ReservationCard
                  key={r.id}
                  r={r}
                  onClick={clickableDetail ? () => setDetail(r) : undefined}
                  onCancel={() => handleCancel(r)}
                  cancelling={cancellingId === r.id}
                />
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
