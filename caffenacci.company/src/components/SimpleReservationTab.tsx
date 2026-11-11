import { useState, useEffect, useCallback } from 'react'
import {
  Check, X, Inbox, ClipboardList, CheckCircle2, XCircle, Link as LinkIcon, RefreshCw,
} from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'
import { useCafeSettings } from './CafeSettingsContext'
import { parseUtc } from '../utils/cafeTime'

// ── Types ─────────────────────────────────────────────────────────────────

type ResStatus = 'pending' | 'confirmed' | 'cancelled'

interface ReservationOut {
  id:               string
  table_id:         string | null
  cafe_id:          string
  date:             string
  start_time:       string
  guests:           number
  guest_name:       string
  guest_phone:      string | null
  guest_email:      string | null
  comment:          string | null
  client_id:        string | null
  created_by_owner: boolean
  status:           ResStatus
  owner_note:       string | null
  created_at:       string | null
}

interface Props {
  token:  string
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

type TFn = ReturnType<typeof useI18n>['t']

function timeAgo(s: string | null, t: TFn): string {
  if (!s) return ''
  const diff = Math.floor((Date.now() - parseUtc(s).getTime()) / 1000)
  if (diff < 60)    return t('time.justNow')
  if (diff < 3600)  return t('time.minutesAgo', { count: Math.floor(diff / 60) })
  if (diff < 86400) return t('time.hoursAgo', { count: Math.floor(diff / 3600) })
  return t('time.daysAgo', { count: Math.floor(diff / 86400) })
}

// ── Decide modal ──────────────────────────────────────────────────────────

interface DecideModalProps {
  reservation:  ReservationOut
  action:       'confirmed' | 'cancelled'
  onConfirm:    (note: string) => void
  onClose:      () => void
  saving:       boolean
}

function DecideModal({ reservation: r, action, onConfirm, onClose, saving }: DecideModalProps) {
  const { t, locale } = useI18n()
  const [note, setNote] = useState('')
  const isConfirm = action === 'confirmed'

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(17,10,4,0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: 480,
        boxShadow: 'var(--shadow-pop)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: isConfirm ? 'var(--sidebar-bg)' : '#5A2323',
          padding: '1.375rem 1.75rem',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: isConfirm ? 'var(--gold-soft)' : '#F0A0A0',
              marginBottom: '0.25rem',
            }}>
              {isConfirm ? t('resSimple.modal.confirmEyebrow') : t('resSimple.modal.rejectEyebrow')}
            </div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.375rem', fontWeight: 600,
              color: 'var(--parchment)',
            }} translate="no">
              {r.guest_name}
            </div>
          </div>
          <button
            className="me-close"
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
          ><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Podsumowanie */}
          <div style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem 1.125rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-dark)', fontWeight: 600 }}>
                {t('res.dateAt', { date: formatDate(r.date, locale), time: r.start_time })}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {t('res.guests', { count: r.guests })}
              </span>
            </div>
            {(r.guest_phone || r.guest_email) && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }} translate="no">
                {r.guest_phone}{r.guest_phone && r.guest_email ? ' · ' : ''}{r.guest_email}
              </div>
            )}
            {r.comment && (
              <div style={{
                fontSize: '0.8125rem', color: 'var(--text-body)',
                fontStyle: 'italic', borderTop: '1px solid var(--border-soft)', paddingTop: '0.5rem', marginTop: '0.25rem',
              }} translate="no">
                {t('common.quoted', { text: r.comment })}
              </div>
            )}
          </div>

          {/* Notatka właściciela */}
          <div className="field">
            <label className="me-label">
              {isConfirm ? t('resSimple.modal.confirmNote') : t('resSimple.modal.rejectNote')}
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={isConfirm ? t('resSimple.modal.confirmPlaceholder') : t('resSimple.modal.rejectPlaceholder')}
              maxLength={500}
              rows={3}
              className="field__input"
              style={{ resize: 'vertical', lineHeight: 1.55 }}
              onFocus={e => (e.target.style.borderColor = 'var(--gold)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              {note.length}/500
            </span>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem 1.5rem',
          display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
          borderTop: '1px solid var(--border-soft)',
        }}>
          <button className="btn btn--outline-dark" type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            style={{
              width: 'auto', minWidth: 160,
              background: isConfirm ? 'var(--espresso)' : '#5A2323',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
            }}
            onClick={() => onConfirm(note)}
            disabled={saving}
          >
            {saving ? (
              t('common.saving')
            ) : isConfirm ? (
              <><Check size={17} /> {t('resSimple.modal.confirmBtn')}</>
            ) : (
              <><X size={17} /> {t('resSimple.modal.rejectBtn')}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reservation card ──────────────────────────────────────────────────────

function PendingCard({
  r,
  onDecide,
}: {
  r: ReservationOut
  onDecide: (r: ReservationOut, action: 'confirmed' | 'cancelled') => void
}) {
  const { t, locale } = useI18n()
  const { timeZone } = useCafeSettings()
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-soft)',
      borderLeft: '3px solid var(--gold)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

        {/* Date block */}
        <div style={{
          flexShrink: 0,
          background: 'var(--sidebar-bg)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.625rem 0.875rem',
          textAlign: 'center',
          minWidth: 60,
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.5rem', fontWeight: 600,
            color: 'var(--gold-soft)', lineHeight: 1,
          }}>
            {r.date.slice(8)}
          </div>
          <div style={{
            fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em',
            color: 'rgba(240,228,204,0.6)', textTransform: 'uppercase', marginTop: '0.25rem',
          }}>
            {new Date(r.date + 'T00:00:00').toLocaleDateString(locale, { month: 'short' })}
          </div>
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-dark)' }} translate="no">
              {r.guest_name}
            </span>
            <span style={{
              background: 'rgba(169,114,47,0.1)', color: 'var(--gold)',
              borderRadius: 100, padding: '1px 8px',
              fontSize: '0.75rem', fontWeight: 600,
            }}>
              {r.start_time}
            </span>
            <span style={{
              background: 'var(--border-soft)', color: 'var(--text-muted)',
              borderRadius: 100, padding: '1px 8px', fontSize: '0.75rem',
            }}>
              {t('res.guests', { count: r.guests })}
            </span>
          </div>

          {(r.guest_phone || r.guest_email) && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }} translate="no">
              {r.guest_phone}{r.guest_phone && r.guest_email ? ' · ' : ''}{r.guest_email}
            </div>
          )}

          {r.comment && (
            <div style={{
              fontSize: '0.8125rem', color: 'var(--text-body)',
              fontStyle: 'italic', marginBottom: '0.25rem',
              background: 'var(--surface-2)',
              borderRadius: 4, padding: '0.25rem 0.5rem',
              display: 'inline-block',
            }} translate="no">
              {t('common.quoted', { text: r.comment })}
            </div>
          )}

          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {t('resSimple.placedAt', { time: timeAgo(r.created_at, t) })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        borderTop: '1px solid var(--border-soft)',
        padding: '0.75rem 1.25rem',
        display: 'flex', justifyContent: 'flex-end', gap: '0.625rem',
        background: 'var(--surface-2)',
      }}>
        <button
          type="button"
          onClick={() => onDecide(r, 'cancelled')}
          style={{
            appearance: 'none', background: 'transparent',
            border: '1.5px solid rgba(178,59,59,0.35)',
            color: 'var(--error)', borderRadius: 'var(--radius-sm)',
            padding: '0.5rem 1rem', fontSize: '0.8125rem',
            fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--error-bg)'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--error)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(178,59,59,0.35)'
          }}
        >
          {t('resSimple.reject')}
        </button>
        <button
          type="button"
          onClick={() => onDecide(r, 'confirmed')}
          className="btn btn--primary"
          style={{ width: 'auto', padding: '0.5rem 1.125rem', fontSize: '0.8125rem', marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
        >
          <Check size={15} />
          {t('resSimple.accept')}
        </button>
      </div>
    </div>
  )
}

// ── History card ──────────────────────────────────────────────────────────

function HistoryCard({ r, onDelete }: { r: ReservationOut; onDelete: (id: string) => void }) {
  const { t, locale } = useI18n()
  const { timeZone } = useCafeSettings()
  const isConfirmed = r.status === 'confirmed'

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-soft)',
      borderLeft: `3px solid ${isConfirmed ? 'var(--success)' : 'var(--error)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '0.875rem 1.25rem',
      display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
      opacity: isConfirmed ? 1 : 0.75,
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{
        flexShrink: 0, paddingTop: '0.125rem',
        color: isConfirmed ? 'var(--success)' : 'var(--error)',
      }}>
        {isConfirmed ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.125rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.9375rem' }} translate="no">
            {r.guest_name}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {t('res.dateAt', { date: formatDate(r.date, locale), time: r.start_time })}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            · {t('res.guests', { count: r.guests })}
          </span>
        </div>
        {r.owner_note && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.125rem' }}>
            {t('resSimple.ownerNote', { note: t('common.quoted', { text: r.owner_note }) })}
          </div>
        )}
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {formatCreatedAt(r.created_at, locale, timeZone)}
        </div>
      </div>
      <button
        type="button"
        className="me-remove-btn me-remove-item"
        onClick={() => onDelete(r.id)}
        title={t('resSimple.deleteTitle')}
        aria-label={t('resSimple.deleteTitle')}
        style={{ flexShrink: 0 }}
      ><X size={13} /></button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function SimpleReservationTab({ token, cafeId }: Props) {
  const { t } = useI18n()
  const [pending,   setPending]   = useState<ReservationOut[]>([])
  const [history,   setHistory]   = useState<ReservationOut[]>([])
  const [loading,   setLoading]   = useState(true)
  const [deciding,  setDeciding]  = useState<{ r: ReservationOut; action: 'confirmed' | 'cancelled' } | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [pendingRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/reservations?status=pending`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/reservations`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (pendingRes.ok) {
        const data = await pendingRes.json()
        setPending(data.reservations ?? [])
      }
      if (historyRes.ok) {
        const data = await historyRes.json()
        const all = data.reservations ?? []
        setHistory(all.filter((r: ReservationOut) => r.status !== 'pending'))
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Decision handler ──────────────────────────────────────────────────

  const handleDecide = async (note: string) => {
    if (!deciding) return
    setSaving(true)
    try {
      const res = await fetch(
        `${API_URL}/reservations/${deciding.r.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: deciding.action, owner_note: note || null }),
        },
      )
      if (!res.ok) throw new Error()
      const updated: ReservationOut = await res.json()
      setPending(prev => prev.filter(r => r.id !== updated.id))
      setHistory(prev => [updated, ...prev])
      setDeciding(null)
    } catch {
      // keep modal open
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('resSimple.deleteConfirm'))) return
    try {
      await fetch(`${API_URL}/reservations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setHistory(prev => prev.filter(r => r.id !== id))
      setPending(prev => prev.filter(r => r.id !== id))
    } catch { /* ignore */ }
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>{t('resSimple.loading')}</p>
      </div>
    )
  }

  // Tab switcher styles
  const tabStyle = (active: boolean): React.CSSProperties => ({
    appearance: 'none' as const,
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
    color: active ? 'var(--text-dark)' : 'var(--text-muted)',
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    fontWeight: active ? 600 : 400,
    padding: '0.625rem 0',
    marginRight: '1.5rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  })

  const badgeStyle = (color: string): React.CSSProperties => ({
    background: color,
    borderRadius: 100,
    padding: '1px 7px',
    fontSize: '0.6875rem',
    fontWeight: 700,
    color: '#fff',
    lineHeight: '1.6',
  })

  return (
    <>
      {deciding && (
        <DecideModal
          reservation={deciding.r}
          action={deciding.action}
          onConfirm={handleDecide}
          onClose={() => setDeciding(null)}
          saving={saving}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* ── Nagłówek ──────────────────────────────────────────────────── */}
        <div>
          <div className="page-header__eyebrow" style={{ marginBottom: '0.375rem' }}>
            {t('common.management')}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.625rem', fontWeight: 600,
              color: 'var(--text-dark)', letterSpacing: '-0.01em',
            }}>
              {t('res.title')}
            </h2>
            <button
              className="btn btn--outline-dark"
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={fetchAll}
            >
              <RefreshCw size={15} />
              {t('common.refresh')}
            </button>
          </div>
        </div>

        {/* ── Public URL info ────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-soft)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.875rem 1.125rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <LinkIcon size={15} />
            {t('resSimple.link')}
          </span>
          <code translate="no" style={{
            fontSize: '0.8rem', color: 'var(--gold)',
            background: 'rgba(169,114,47,0.08)',
            borderRadius: 4, padding: '2px 8px',
            wordBreak: 'break-all',
          }}>
            POST /reservations/public/{cafeId}
          </code>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('resSimple.linkSoon')}
          </span>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            style={tabStyle(activeTab === 'pending')}
            onClick={() => setActiveTab('pending')}
          >
            {t('resSimple.tab.pending')}
            {pending.length > 0 && (
              <span style={badgeStyle('var(--gold)')}>{pending.length}</span>
            )}
          </button>
          <button
            type="button"
            style={tabStyle(activeTab === 'history')}
            onClick={() => setActiveTab('history')}
          >
            {t('resSimple.tab.history')}
            {history.length > 0 && (
              <span style={badgeStyle('var(--text-muted)')}>{history.length}</span>
            )}
          </button>
        </div>

        {/* ── Pending list ───────────────────────────────────────────────── */}
        {activeTab === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {pending.length === 0 ? (
              <div className="res-empty-card">
                <div className="res-empty-icon"><Inbox size={44} strokeWidth={1.4} /></div>
                <div className="res-empty-title">{t('resSimple.empty.pending.title')}</div>
                <div className="res-empty-sub">{t('resSimple.empty.pending.sub')}</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {t('resSimple.pending.count', { count: pending.length })}
                </div>
                {pending
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
                  .map(r => (
                    <PendingCard
                      key={r.id}
                      r={r}
                      onDecide={(r, action) => setDeciding({ r, action })}
                    />
                  ))}
              </>
            )}
          </div>
        )}

        {/* ── History list ───────────────────────────────────────────────── */}
        {activeTab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {history.length === 0 ? (
              <div className="res-empty-card">
                <div className="res-empty-icon"><ClipboardList size={44} strokeWidth={1.4} /></div>
                <div className="res-empty-title">{t('resSimple.empty.history.title')}</div>
                <div className="res-empty-sub">{t('resSimple.empty.history.sub')}</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  {t('resSimple.history.summary', {
                    confirmed: history.filter(r => r.status === 'confirmed').length,
                    cancelled: history.filter(r => r.status === 'cancelled').length,
                  })}
                </div>
                {history
                  .slice()
                  .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
                  .map(r => (
                    <HistoryCard key={r.id} r={r} onDelete={handleDelete} />
                  ))}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
