import { useState, useEffect, useCallback, useMemo } from 'react'

// ── Typy ─────────────────────────────────────────────────────────────────

type TableTypeEnum = 'standard' | 'communal' | 'special'

interface TableInfo {
  id: string
  table_type: TableTypeEnum
  seats: number
  quantity: number
  label: string | null
}

interface DayHoursInfo {
  day_of_week: number
  open_time: string | null
  close_time: string | null
}

interface OccupiedSlot {
  table_id: string
  start_time: string
  end_time: string
  guests: number
}

interface ReservationInfo {
  cafe_id: string
  enabled: boolean
  mode: string
  slot_duration_minutes: number
  tables: TableInfo[]
  hours: DayHoursInfo[]
  occupied: OccupiedSlot[]
}

interface Props {
  cafeId: string
  requireLogin: (action: () => void) => void
  authToken: string | null
}

const TABLE_TYPE_LABELS: Record<TableTypeEnum, string> = {
  standard: 'Zwykły stolik',
  communal: 'Stół komunalny',
  special: 'Stolik specjalny',
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
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

function dayOfWeekFromDate(dateStr: string): number {
  // JS getDay(): 0=niedziela ... backend: 0=poniedziałek
  const d = new Date(dateStr + 'T00:00:00')
  return (d.getDay() + 6) % 7
}

export default function AdvancedReservationForm({ cafeId, requireLogin, authToken }: Props) {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<ReservationInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)

  const [date, setDate] = useState(todayStr())
  const [tableId, setTableId] = useState('')
  const [guests, setGuests] = useState(2)
  const [startTime, setStartTime] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [comment, setComment] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // ── Wczytanie dostępności dla wybranej daty ──────────────────────────

  const fetchInfo = useCallback(async (d: string) => {
    setLoadingInfo(true)
    try {
      const res = await fetch(`http://localhost:8000/reservations/info/${cafeId}?date=${d}`)
      if (res.ok) setInfo(await res.json())
    } catch { /* ignore */ }
    finally { setLoadingInfo(false) }
  }, [cafeId])

  useEffect(() => {
    if (open) fetchInfo(date)
  }, [open, date, fetchInfo])

  useEffect(() => {
    if (info && info.tables.length > 0 && !tableId) {
      setTableId(info.tables[0].id)
    }
  }, [info, tableId])

  const selectedTable = info?.tables.find(t => t.id === tableId) ?? null

  const dayHours = useMemo(() => {
    if (!info) return null
    const dow = dayOfWeekFromDate(date)
    return info.hours.find(h => h.day_of_week === dow) ?? null
  }, [info, date])

  // ── Sloty czasowe z dostępnością (odzwierciedla logikę backendu) ─────

  const slots = useMemo(() => {
    if (!info || !dayHours || !dayHours.open_time || !dayHours.close_time || !selectedTable) return []

    const openM  = toMinutes(dayHours.open_time)
    const closeM = toMinutes(dayHours.close_time)
    const duration = info.slot_duration_minutes

    const result: { time: string; available: boolean; reason?: string }[] = []

    for (let m = openM; m < closeM; m += duration) {
      const slotStart = m
      const slotEnd = m + duration
      const time = fromMinutes(m)

      const overlapping = info.occupied.filter(o =>
        o.table_id === selectedTable.id &&
        slotStart < toMinutes(o.end_time) &&
        slotEnd > toMinutes(o.start_time)
      )

      let available = true
      let reason: string | undefined

      if (guests > selectedTable.seats) {
        available = false
        reason = `Stolik ma tylko ${selectedTable.seats} miejsc`
      } else if (selectedTable.table_type === 'communal') {
        const takenSeats = overlapping.reduce((sum, o) => sum + o.guests, 0)
        if (takenSeats + guests > selectedTable.seats) {
          available = false
          reason = `Za mało wolnych miejsc (zajęte: ${takenSeats}/${selectedTable.seats})`
        }
      } else if (overlapping.length > 0) {
        available = false
        reason = 'Stolik zajęty w tym terminie'
      }

      result.push({ time, available, reason })
    }

    return result
  }, [info, dayHours, selectedTable, guests])

  useEffect(() => { setStartTime(null) }, [tableId, date, guests])

  // ── Submit ────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!authToken || !tableId || !startTime) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`http://localhost:8000/reservations/client/${cafeId}/advanced`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          table_id: tableId,
          date,
          start_time: startTime,
          guests,
          guest_phone: phone.trim() || null,
          guest_email: email.trim() || null,
          comment: comment.trim() || null,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Błąd rezerwacji.')
      }
      setSuccess(true)
      setStartTime(null)
      fetchInfo(date) // odśwież zajętość
      setTimeout(() => { setSuccess(false); setOpen(false) }, 3500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Błąd rezerwacji.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn--primary" style={{ width: 'auto' }}
        onClick={() => requireLogin(() => setOpen(true))}>
        📅 Zarezerwuj stolik
      </button>
    )
  }

  return (
    <div className="res-table-row" style={{ marginTop: '1rem', maxWidth: 620 }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '1 1 150px' }}>
          <label className="me-label">Data</label>
          <input type="date" className="me-input" value={date} min={todayStr()} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="field" style={{ flex: '1 1 220px' }}>
          <label className="me-label">Stolik</label>
          <select
            className="me-input" style={{ cursor: 'pointer' }}
            value={tableId}
            onChange={e => setTableId(e.target.value)}
            disabled={!info || info.tables.length === 0}
          >
            {(info?.tables ?? []).map(t => (
              <option key={t.id} value={t.id}>
                {TABLE_TYPE_LABELS[t.table_type]} · {t.seats} os.{t.label ? ` (${t.label})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ flex: '1 1 90px' }}>
          <label className="me-label">Goście {selectedTable ? `(maks. ${selectedTable.seats})` : ''}</label>
          <input type="number" min={1} max={selectedTable?.seats ?? 50} className="me-input"
            value={guests} onChange={e => setGuests(Number(e.target.value))} />
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label className="me-label">Godzina</label>
        {loadingInfo ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Sprawdzanie dostępności…</p>
        ) : !info || !info.tables.length ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Brak skonfigurowanych stolików.</p>
        ) : !dayHours || !dayHours.open_time || !dayHours.close_time ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginTop: '0.5rem' }}>W tym dniu kawiarnia jest zamknięta.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {slots.map(s => (
              <button
                key={s.time}
                type="button"
                title={s.reason}
                disabled={!s.available}
                onClick={() => setStartTime(s.time)}
                className={
                  'cp-slot-btn' +
                  (startTime === s.time ? ' cp-slot-btn--selected' : '') +
                  (!s.available ? ' cp-slot-btn--unavailable' : '')
                }
              >
                {s.time}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="me-label">Telefon (opcjonalnie)</label>
          <input type="tel" className="me-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+48 123 456 789" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="me-label">E-mail (opcjonalnie)</label>
          <input type="email" className="me-input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </div>

      <div className="field" style={{ marginTop: '0.75rem' }}>
        <label className="me-label">Komentarz</label>
        <input type="text" className="me-input" value={comment} onChange={e => setComment(e.target.value)} placeholder="np. stolik przy oknie…" />
      </div>

      {error && <div className="form-error" style={{ marginTop: '0.75rem' }}>{error}</div>}
      {success && (
        <div className="form-success" style={{ marginTop: '0.75rem' }}>
          Stolik zarezerwowany! Rezerwacja jest od razu potwierdzona — nie czeka na akceptację.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
        <button type="button" className="btn btn--outline-dark" onClick={() => setOpen(false)}>Anuluj</button>
        <button
          type="button" className="btn btn--primary" style={{ width: 'auto' }}
          onClick={handleSubmit}
          disabled={submitting || !tableId || !startTime}
        >
          {submitting ? 'Rezerwowanie…' : 'Zarezerwuj stolik'}
        </button>
      </div>
    </div>
  )
}