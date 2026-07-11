import { useState, useEffect, useCallback } from 'react'

// ── Typy ──────────────────────────────────────────────────────────────────

type ResStatus = 'pending' | 'confirmed' | 'cancelled'

interface ClientReservation {
  id: string
  table_id: string | null
  cafe_id: string
  cafe_name: string
  is_advanced: boolean
  date: string
  start_time: string
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
}

interface Props { token: string }

const TABLE_TYPE_LABELS: Record<string, string> = {
  standard: 'Zwykły stolik',
  communal: 'Stół komunalny',
  special: 'Stolik specjalny',
}

// ── Helpery ───────────────────────────────────────────────────────────────

function guestsLabel(n: number) {
  if (n === 1) return '1 osoba'
  if (n < 5) return `${n} osoby`
  return `${n} osób`
}

function formatDate(ds: string) {
  const d = new Date(ds + 'T00:00:00')
  return d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Rezerwacja "przenosi się" do historii godzinę po planowanym terminie.
function endTimestamp(r: ClientReservation): number {
  const [h, m] = r.start_time.split(':').map(Number)
  const d = new Date(r.date + 'T00:00:00')
  d.setHours(h, m, 0, 0)
  return d.getTime() + 60 * 60 * 1000
}

function isPast(r: ClientReservation): boolean {
  return endTimestamp(r) < Date.now()
}

function statusMeta(r: ClientReservation): { label: string; cls: string } {
  if (r.is_advanced) return { label: 'Potwierdzona', cls: 'status-badge--confirmed' }
  if (r.status === 'pending') return { label: 'Oczekuje', cls: 'status-badge--pending' }
  if (r.status === 'confirmed') return { label: 'Potwierdzona', cls: 'status-badge--confirmed' }
  return { label: 'Odrzucona', cls: 'status-badge--cancelled' }
}

function tableDescription(r: ClientReservation): string {
  if (!r.table_type) return ''
  const base = TABLE_TYPE_LABELS[r.table_type] ?? r.table_type
  if (r.table_label) return `${base} – ${r.table_label}`
  if (r.table_seats) return `${base} (${r.table_seats} os.)`
  return base
}

// ── Karta rezerwacji ──────────────────────────────────────────────────────

function ReservationCard({ r, onClick }: { r: ClientReservation; onClick?: () => void }) {
  const meta = statusMeta(r)
  const clickable = !!onClick
  const tableDesc = tableDescription(r)

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
          <div className="entity-card__date-month">
            {new Date(r.date + 'T00:00:00').toLocaleDateString('pl-PL', { month: 'short' })}
          </div>
          <div className="entity-card__date-time">{r.start_time}</div>
        </div>

        <div className="entity-card__main">
          <div className="entity-card__header">
            <span className="entity-card__cafe">{r.cafe_name}</span>
            <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
          </div>

          <div className="entity-card__sub">
            {guestsLabel(r.guests)}
            {tableDesc && <> · {tableDesc}</>}
            {r.is_advanced && <> · rezerwacja zaawansowana</>}
          </div>

          {(r.guest_phone || r.guest_email) && (
            <div className="entity-card__sub" style={{ marginTop: '0.25rem' }}>
              {r.guest_phone}{r.guest_phone && r.guest_email ? ' · ' : ''}{r.guest_email}
            </div>
          )}

          {r.comment && (
            <div className="entity-card__sub" style={{ marginTop: '0.25rem', fontStyle: 'italic' }}>
              „{r.comment}"
            </div>
          )}

          {clickable && (
            <div className="entity-card__hint">Kliknij, aby zobaczyć wiadomość od kawiarni →</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal ze szczegółami / wiadomością od kawiarni ─────────────────────────

function ReservationDetailModal({ r, onClose }: { r: ClientReservation; onClose: () => void }) {
  const meta = statusMeta(r)
  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor" style={{ height: 'auto', maxHeight: '90vh' }}>
        <div className="me-header">
          <div>
            <div className="me-eyebrow">{r.cafe_name}</div>
            <h2 className="me-title">Rezerwacja · {formatDate(r.date)}</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>

        <div className="me-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="res-table-row">
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                📅 {formatDate(r.date)} o {r.start_time}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                👥 {guestsLabel(r.guests)}
              </span>
            </div>
            <span className={`status-badge ${meta.cls}`}>{meta.label}</span>
            {r.comment && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-body)', fontStyle: 'italic', marginTop: '0.75rem' }}>
                Twój komentarz: „{r.comment}"
              </div>
            )}
          </div>

          <div>
            <label className="me-label">Wiadomość od kawiarni</label>
            {r.owner_note ? (
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-dark)', lineHeight: 1.6 }}>{r.owner_note}</p>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Kawiarnia nie dodała żadnej wiadomości.
              </p>
            )}
          </div>
        </div>

        <div className="me-footer">
          <button type="button" className="btn btn--outline-dark" onClick={onClose}>Zamknij</button>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════════

export default function MyReservationsTab({ token }: Props) {
  const [reservations, setReservations] = useState<ClientReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSub, setActiveSub] = useState<'current' | 'history'>('current')
  const [detail, setDetail] = useState<ClientReservation | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/reservations/client/mine', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setReservations(data.reservations ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  const current = reservations
    .filter(r => !isPast(r))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))

  const history = reservations
    .filter(r => isPast(r))
    .sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time))

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Wczytywanie rezerwacji…</p>
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
            <div className="page-header__eyebrow">Twoje konto</div>
            <h1 className="page-header__title" style={{ fontSize: '1.625rem' }}>Rezerwacje</h1>
          </div>
          <button className="btn btn--outline-dark" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem' }} onClick={fetchAll}>
            ↻ Odśwież
          </button>
        </div>

        <div className="subtab-row">
          <button type="button" className={`subtab-btn${activeSub === 'current' ? ' subtab-btn--active' : ''}`} onClick={() => setActiveSub('current')}>
            Aktualne
            {current.length > 0 && <span className="subtab-badge">{current.length}</span>}
          </button>
          <button type="button" className={`subtab-btn${activeSub === 'history' ? ' subtab-btn--active' : ''}`} onClick={() => setActiveSub('history')}>
            Historia
            {history.length > 0 && <span className="subtab-badge subtab-badge--muted">{history.length}</span>}
          </button>
        </div>

        {list.length === 0 ? (
          <div className="res-empty-card">
            <div className="res-empty-icon">📅</div>
            <div className="res-empty-title">
              {activeSub === 'current' ? 'Brak nadchodzących rezerwacji' : 'Brak historii rezerwacji'}
            </div>
            <div className="res-empty-sub">
              {activeSub === 'current'
                ? 'Twoje rezerwacje we wszystkich kawiarniach pojawią się tutaj.'
                : 'Zakończone rezerwacje pojawiają się tutaj godzinę po planowanym terminie.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {list.map(r => {
              const clickableDetail = !r.is_advanced && (r.status === 'confirmed' || r.status === 'cancelled')
              return (
                <ReservationCard
                  key={r.id}
                  r={r}
                  onClick={clickableDetail ? () => setDetail(r) : undefined}
                />
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}