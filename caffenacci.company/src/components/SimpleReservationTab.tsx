import { useState, useEffect, useCallback } from 'react'

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

function guestsLabel(n: number) {
  if (n === 1) return '1 osoba'
  if (n < 5)   return `${n} osoby`
  return `${n} osób`
}

function formatDate(ds: string) {
  const d = new Date(ds + 'T00:00:00')
  return d.toLocaleDateString('pl-PL', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

function formatCreatedAt(s: string | null) {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleString('pl-PL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(s: string | null): string {
  if (!s) return ''
  const diff = Math.floor((Date.now() - new Date(s).getTime()) / 1000)
  if (diff < 60)    return 'przed chwilą'
  if (diff < 3600)  return `${Math.floor(diff / 60)} min temu`
  if (diff < 86400) return `${Math.floor(diff / 3600)} godz. temu`
  return `${Math.floor(diff / 86400)} dni temu`
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
  const [note, setNote] = useState('')
  const isConfirm = action === 'confirmed'

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(17,10,4,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--cream)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 480,
        boxShadow: '0 24px 64px rgba(17,10,4,0.22)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: isConfirm ? 'var(--espresso)' : '#6B2020',
          padding: '1.375rem 1.75rem',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: isConfirm ? 'var(--gold)' : '#F08080',
              marginBottom: '0.25rem',
            }}>
              {isConfirm ? 'Akceptacja rezerwacji' : 'Odrzucenie rezerwacji'}
            </div>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.375rem', fontWeight: 600,
              color: 'var(--parchment)',
            }}>
              {r.guest_name}
            </div>
          </div>
          <button
            className="me-close"
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Podsumowanie */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '1rem 1.125rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
          }}>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-dark)', fontWeight: 600 }}>
                📅 {formatDate(r.date)} o {r.start_time}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                👥 {guestsLabel(r.guests)}
              </span>
            </div>
            {(r.guest_phone || r.guest_email) && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {r.guest_phone}{r.guest_phone && r.guest_email ? ' · ' : ''}{r.guest_email}
              </div>
            )}
            {r.comment && (
              <div style={{
                fontSize: '0.8125rem', color: 'var(--text-body)',
                fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.25rem',
              }}>
                „{r.comment}"
              </div>
            )}
          </div>

          {/* Notatka właściciela */}
          <div className="field">
            <label className="me-label">
              {isConfirm
                ? 'Wiadomość dla klienta (opcjonalnie)'
                : 'Powód odrzucenia (opcjonalnie)'}
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={isConfirm
                ? 'np. Widzimy się w czwartek! Zarezerwowaliśmy dla Państwa najlepszy stolik.'
                : 'np. Przepraszamy, wybrany termin jest już zajęty. Zapraszamy w innym czasie.'}
              maxLength={500}
              rows={3}
              style={{
                appearance: 'none',
                width: '100%',
                background: 'transparent',
                border: '1.5px solid var(--border)',
                borderRadius: 6,
                padding: '0.625rem 0.75rem',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                color: 'var(--text-dark)',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.15s',
                lineHeight: 1.55,
              }}
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
          borderTop: '1px solid var(--border)',
        }}>
          <button className="btn btn--outline-dark" type="button" onClick={onClose}>
            Anuluj
          </button>
          <button
            type="button"
            className="btn btn--primary"
            style={{
              width: 'auto', minWidth: 160,
              background: isConfirm ? 'var(--espresso)' : '#6B2020',
            }}
            onClick={() => onConfirm(note)}
            disabled={saving}
          >
            {saving
              ? 'Zapisywanie…'
              : isConfirm ? '✓ Akceptuj rezerwację' : '✕ Odrzuć rezerwację'}
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
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: '3px solid var(--gold)',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

        {/* Date block */}
        <div style={{
          flexShrink: 0,
          background: 'var(--espresso)',
          borderRadius: 8,
          padding: '0.625rem 0.875rem',
          textAlign: 'center',
          minWidth: 60,
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: '1.5rem', fontWeight: 600,
            color: 'var(--gold)', lineHeight: 1,
          }}>
            {r.date.slice(8)}
          </div>
          <div style={{
            fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em',
            color: 'rgba(240,228,204,0.6)', textTransform: 'uppercase', marginTop: '0.25rem',
          }}>
            {new Date(r.date + 'T00:00:00').toLocaleDateString('pl-PL', { month: 'short' })}
          </div>
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-dark)' }}>
              {r.guest_name}
            </span>
            <span style={{
              background: 'rgba(181,114,10,0.1)', color: 'var(--gold)',
              borderRadius: 100, padding: '1px 8px',
              fontSize: '0.75rem', fontWeight: 600,
            }}>
              {r.start_time}
            </span>
            <span style={{
              background: 'var(--border)', color: 'var(--text-muted)',
              borderRadius: 100, padding: '1px 8px', fontSize: '0.75rem',
            }}>
              {guestsLabel(r.guests)}
            </span>
          </div>

          {(r.guest_phone || r.guest_email) && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              {r.guest_phone}{r.guest_phone && r.guest_email ? ' · ' : ''}{r.guest_email}
            </div>
          )}

          {r.comment && (
            <div style={{
              fontSize: '0.8125rem', color: 'var(--text-body)',
              fontStyle: 'italic', marginBottom: '0.25rem',
              background: 'rgba(240,228,204,0.5)',
              borderRadius: 4, padding: '0.25rem 0.5rem',
              display: 'inline-block',
            }}>
              „{r.comment}"
            </div>
          )}

          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Złożono: {timeAgo(r.created_at)}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '0.75rem 1.25rem',
        display: 'flex', justifyContent: 'flex-end', gap: '0.625rem',
        background: 'rgba(250,250,247,0.6)',
      }}>
        <button
          type="button"
          onClick={() => onDecide(r, 'cancelled')}
          style={{
            appearance: 'none', background: 'transparent',
            border: '1.5px solid rgba(184,50,50,0.35)',
            color: 'var(--error)', borderRadius: 6,
            padding: '0.5rem 1rem', fontSize: '0.8125rem',
            fontFamily: 'inherit', fontWeight: 500, cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.target as HTMLButtonElement).style.background = 'var(--error-bg)'
            ;(e.target as HTMLButtonElement).style.borderColor = 'var(--error)'
          }}
          onMouseLeave={e => {
            (e.target as HTMLButtonElement).style.background = 'transparent'
            ;(e.target as HTMLButtonElement).style.borderColor = 'rgba(184,50,50,0.35)'
          }}
        >
          Odrzuć
        </button>
        <button
          type="button"
          onClick={() => onDecide(r, 'confirmed')}
          className="btn btn--primary"
          style={{ width: 'auto', padding: '0.5rem 1.125rem', fontSize: '0.8125rem', marginTop: 0 }}
        >
          ✓ Akceptuj
        </button>
      </div>
    </div>
  )
}

// ── History card ──────────────────────────────────────────────────────────

function HistoryCard({ r, onDelete }: { r: ReservationOut; onDelete: (id: string) => void }) {
  const isConfirmed = r.status === 'confirmed'

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${isConfirmed ? 'var(--success)' : 'var(--error)'}`,
      borderRadius: 8,
      padding: '0.875rem 1.25rem',
      display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
      opacity: isConfirmed ? 1 : 0.7,
    }}>
      <div style={{
        fontSize: '1.25rem', flexShrink: 0, paddingTop: '0.125rem',
      }}>
        {isConfirmed ? '✅' : '❌'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.125rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.9375rem' }}>
            {r.guest_name}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {formatDate(r.date)} o {r.start_time}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            · {guestsLabel(r.guests)}
          </span>
        </div>
        {r.owner_note && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.125rem' }}>
            Wiadomość do klienta: „{r.owner_note}"
          </div>
        )}
        <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          {formatCreatedAt(r.created_at)}
        </div>
      </div>
      <button
        type="button"
        className="me-remove-btn me-remove-item"
        onClick={() => onDelete(r.id)}
        title="Usuń z historii"
        style={{ flexShrink: 0 }}
      >✕</button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function SimpleReservationTab({ token, cafeId }: Props) {
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
        fetch('http://localhost:8000/reservations?status=pending', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('http://localhost:8000/reservations', {
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
        `http://localhost:8000/reservations/${deciding.r.id}/status`,
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
    if (!confirm('Usunąć tę rezerwację z historii?')) return
    try {
      await fetch(`http://localhost:8000/reservations/${id}`, {
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
        <p>Wczytywanie rezerwacji…</p>
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
          <div style={{
            fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.375rem',
          }}>
            Zarządzanie
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '1.625rem', fontWeight: 600,
              color: 'var(--text-dark)', letterSpacing: '-0.01em',
            }}>
              Rezerwacje stolików
            </h2>
            <button
              className="btn btn--outline-dark"
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
              onClick={fetchAll}
            >
              ↻ Odśwież
            </button>
          </div>
        </div>

        {/* ── Public URL info ────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.875rem 1.125rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            🔗 Link do rezerwacji dla klientów:
          </span>
          <code style={{
            fontSize: '0.8rem', color: 'var(--gold)',
            background: 'rgba(181,114,10,0.08)',
            borderRadius: 4, padding: '2px 8px',
            wordBreak: 'break-all',
          }}>
            POST /reservations/public/{cafeId}
          </code>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            (panel klienta będzie dostępny wkrótce)
          </span>
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────── */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            style={tabStyle(activeTab === 'pending')}
            onClick={() => setActiveTab('pending')}
          >
            Oczekujące
            {pending.length > 0 && (
              <span style={badgeStyle('var(--gold)')}>{pending.length}</span>
            )}
          </button>
          <button
            type="button"
            style={tabStyle(activeTab === 'history')}
            onClick={() => setActiveTab('history')}
          >
            Historia
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
                <div className="res-empty-icon">📭</div>
                <div className="res-empty-title">Brak nowych rezerwacji</div>
                <div className="res-empty-sub">
                  Gdy klient złoży rezerwację, pojawi się ona tutaj do zatwierdzenia.
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {pending.length === 1
                    ? '1 rezerwacja czeka na Twoją decyzję'
                    : `${pending.length} rezerwacji czeka na Twoją decyzję`}
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
                <div className="res-empty-icon">📋</div>
                <div className="res-empty-title">Brak historii rezerwacji</div>
                <div className="res-empty-sub">
                  Tu pojawią się zaakceptowane i odrzucone rezerwacje.
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                  {history.filter(r => r.status === 'confirmed').length} zaakceptowanych
                  {' · '}
                  {history.filter(r => r.status === 'cancelled').length} odrzuconych
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