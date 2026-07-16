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

interface HourExceptionInfo {
  date: string
  is_closed: boolean
  open_time: string | null
  close_time: string | null
}

interface ReservationInfo {
  cafe_id: string
  enabled: boolean
  mode: string
  slot_duration_minutes: number
  tables: TableInfo[]
  hours: DayHoursInfo[]
  occupied: OccupiedSlot[]
  hour_exceptions: HourExceptionInfo[]
}

interface Props {
  cafeId: string
  requireLogin: (action: () => void) => void
  authToken: string | null
}

// Grupa identycznych stolików (ten sam typ, liczba miejsc i etykieta) —
// dla klienta liczy się tylko "jaki to rodzaj stolika", a nie który
// dokładnie egzemplarz. System sam przydziela wolny stolik z grupy.
interface TableGroup {
  key: string
  table_type: TableTypeEnum
  seats: number
  label: string | null
  tables: TableInfo[]
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

function formatExceptionDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })
}

function formatExceptionSentence(e: HourExceptionInfo): string {
  const label = formatExceptionDateLabel(e.date)
  if (e.is_closed || !e.open_time || !e.close_time) {
    return `${label} kawiarnia będzie nieczynna.`
  }
  return `${label} kawiarnia będzie pracować w godzinach ${e.open_time}–${e.close_time}.`
}

// Grupuje surową listę stolików wg (typ, miejsca, etykieta) — kolejność
// wewnątrz grupy jest stabilna (wg id), żeby przydział "pierwszego wolnego"
// stolika był deterministyczny i powtarzalny.
function groupTables(tables: TableInfo[]): TableGroup[] {
  const map = new Map<string, TableGroup>()
  for (const t of tables) {
    const key = `${t.table_type}-${t.seats}-${t.label ?? ''}`
    if (!map.has(key)) {
      map.set(key, { key, table_type: t.table_type, seats: t.seats, label: t.label, tables: [] })
    }
    map.get(key)!.tables.push(t)
  }
  for (const g of map.values()) {
    g.tables.sort((a, b) => a.id.localeCompare(b.id))
  }
  return Array.from(map.values())
}

// Zwraca id stolików z danej grupy, które są faktycznie wolne (albo mają
// wystarczająco miejsc — dla stołów komunalnych) o wskazanej godzinie,
// w kolejności, w jakiej należy próbować je przydzielić klientowi.
function availableTableIdsInGroup(
  group: TableGroup,
  occupied: OccupiedSlot[],
  slotDurationMinutes: number,
  startTime: string,
  guests: number,
): string[] {
  const slotStart = toMinutes(startTime)
  const slotEnd = slotStart + slotDurationMinutes
  const result: string[] = []

  for (const table of group.tables) {
    const overlapping = occupied.filter(o =>
      o.table_id === table.id &&
      slotStart < toMinutes(o.end_time) &&
      slotEnd > toMinutes(o.start_time)
    )

    if (table.table_type === 'communal') {
      const takenSeats = overlapping.reduce((sum, o) => sum + o.guests, 0)
      if (takenSeats + guests <= table.seats) result.push(table.id)
    } else if (overlapping.length === 0) {
      result.push(table.id)
    }
  }

  return result
}

export default function AdvancedReservationForm({ cafeId, requireLogin, authToken }: Props) {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<ReservationInfo | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)

  const [date, setDate] = useState(todayStr())
  const [groupKey, setGroupKey] = useState('')
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

  // Stoliki tego samego rodzaju (typ + miejsca + etykieta) są dla klienta
  // jedną pozycją do wyboru — system sam przydzieli konkretny wolny egzemplarz.
  const groups = useMemo<TableGroup[]>(() => {
    if (!info) return []
    return groupTables(info.tables)
  }, [info])

  useEffect(() => {
    if (groups.length > 0 && !groups.some(g => g.key === groupKey)) {
      setGroupKey(groups[0].key)
    }
  }, [groups, groupKey])

  const selectedGroup = groups.find(g => g.key === groupKey) ?? null

  // Wyjątek godzinowy (ustawiony w profilu kawiarni) dla dokładnie wybranej
  // daty — jeśli istnieje, nadpisuje plan tygodniowy z ustawień rezerwacji,
  // tak samo jak dzieje się to na publicznej wizytówce kawiarni.
  const dateException = useMemo(() => {
    if (!info) return null
    return info.hour_exceptions.find(e => e.date === date) ?? null
  }, [info, date])

  const dayHours = useMemo(() => {
    if (!info) return null
    if (dateException) {
      return {
        day_of_week: dayOfWeekFromDate(date),
        open_time: dateException.is_closed ? null : dateException.open_time,
        close_time: dateException.is_closed ? null : dateException.close_time,
      }
    }
    const dow = dayOfWeekFromDate(date)
    return info.hours.find(h => h.day_of_week === dow) ?? null
  }, [info, date, dateException])

  // ── Sloty czasowe z dostępnością — łączona (dowolny wolny stolik z grupy) ─

  const slots = useMemo(() => {
    if (!info || !dayHours || !dayHours.open_time || !dayHours.close_time || !selectedGroup) return []

    const openM  = toMinutes(dayHours.open_time)
    const closeM = toMinutes(dayHours.close_time)
    const duration = info.slot_duration_minutes

    // Dla dzisiejszej daty ukrywamy godziny, które już minęły lub trwają —
    // rezerwacja musi dotyczyć przyszłego momentu.
    const isToday = date === todayStr()
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()

    const result: { time: string; available: boolean; reason?: string }[] = []

    for (let m = openM; m < closeM; m += duration) {
      if (isToday && m <= nowMinutes) continue

      const time = fromMinutes(m)

      if (guests > selectedGroup.seats) {
        result.push({ time, available: false, reason: `Stolik ma tylko ${selectedGroup.seats} miejsc` })
        continue
      }

      const candidates = availableTableIdsInGroup(selectedGroup, info.occupied, duration, time, guests)
      const available = candidates.length > 0
      const reason = available
        ? undefined
        : selectedGroup.table_type === 'communal'
          ? 'Za mało wolnych miejsc przy stołach tego typu'
          : 'Wszystkie stoliki tego typu są zajęte w tym terminie'

      result.push({ time, available, reason })
    }

    return result
  }, [info, dayHours, selectedGroup, guests, date])

  useEffect(() => { setStartTime(null) }, [groupKey, date, guests])

  // ── Submit ────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!authToken || !selectedGroup || !startTime || !info) return

    setSubmitting(true)
    setError(null)

    // Wolne stoliki z grupy w kolejności, w jakiej próbujemy je zarezerwować.
    const candidates = availableTableIdsInGroup(
      selectedGroup, info.occupied, info.slot_duration_minutes, startTime, guests,
    )

    if (candidates.length === 0) {
      setError('Ten termin nie jest już dostępny — wybierz inną godzinę.')
      setSubmitting(false)
      fetchInfo(date)
      return
    }

    let lastErrorMessage = 'Błąd rezerwacji.'

    for (const candidateTableId of candidates) {
      try {
        const res = await fetch(`http://localhost:8000/reservations/client/${cafeId}/advanced`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            table_id: candidateTableId,
            date,
            start_time: startTime,
            guests,
            guest_phone: phone.trim() || null,
            guest_email: email.trim() || null,
            comment: comment.trim() || null,
          }),
        })

        if (res.ok) {
          setSuccess(true)
          setStartTime(null)
          fetchInfo(date) // odśwież zajętość
          setTimeout(() => { setSuccess(false); setOpen(false) }, 3500)
          setSubmitting(false)
          return
        }

        const e = await res.json()
        lastErrorMessage = e.detail || 'Błąd rezerwacji.'

        // Ktoś zdążył zająć akurat ten stolik w międzyczasie — spróbuj
        // kolejnego wolnego egzemplarza z tej samej grupy zanim się poddamy.
        const isConflict = res.status === 400 && /zajęt/i.test(lastErrorMessage)
        if (!isConflict) break
      } catch {
        lastErrorMessage = 'Błąd rezerwacji.'
        break
      }
    }

    setError(lastErrorMessage)
    fetchInfo(date)
    setSubmitting(false)
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
            value={groupKey}
            onChange={e => setGroupKey(e.target.value)}
            disabled={!info || groups.length === 0}
          >
            {groups.map(g => (
              <option key={g.key} value={g.key}>
                {TABLE_TYPE_LABELS[g.table_type]} · {g.seats} os.{g.label ? ` (${g.label})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="field" style={{ flex: '1 1 90px' }}>
          <label className="me-label">Goście {selectedGroup ? `(maks. ${selectedGroup.seats})` : ''}</label>
          <input type="number" min={1} max={selectedGroup?.seats ?? 50} className="me-input"
            value={guests} onChange={e => setGuests(Number(e.target.value))} />
        </div>
      </div>

      {info && info.hour_exceptions.filter(e => e.date >= todayStr()).length > 0 && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {info.hour_exceptions
            .filter(e => e.date >= todayStr())
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 5)
            .map(e => (
              <p key={e.date} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                📌 {formatExceptionSentence(e)}
              </p>
            ))}
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <label className="me-label">Godzina</label>
        {loadingInfo ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Sprawdzanie dostępności…</p>
        ) : !info || groups.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Brak skonfigurowanych stolików.</p>
        ) : !dayHours || !dayHours.open_time || !dayHours.close_time ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--error)', marginTop: '0.5rem' }}>
            {dateException?.is_closed
              ? 'Tego dnia kawiarnia jest wyjątkowo zamknięta.'
              : 'W tym dniu kawiarnia jest zamknięta.'}
          </p>
        ) : (
          <>
            {dateException && !dateException.is_closed && (
              <p style={{ fontSize: '0.75rem', color: 'var(--gold)', fontWeight: 600, marginTop: '0.5rem', marginBottom: 0 }}>
                ⓘ Tego dnia obowiązują wyjątkowe godziny: {dateException.open_time}–{dateException.close_time}
              </p>
            )}
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
          </>
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
          disabled={submitting || !selectedGroup || !startTime}
        >
          {submitting ? 'Rezerwowanie…' : 'Zarezerwuj stolik'}
        </button>
      </div>
    </div>
  )
}