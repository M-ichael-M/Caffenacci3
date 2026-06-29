import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────

type TableTypeEnum = 'standard' | 'communal' | 'special'
type ResModeType   = 'simple'   | 'advanced'

interface DayHours {
  id?:         string
  day_of_week: number
  open_time:   string | null
  close_time:  string | null
}

interface CafeTableDraft {
  _uid:       string
  table_type: TableTypeEnum
  seats:      number
  quantity:   number
  label:      string
}

interface CafeTableOut {
  id:         string
  table_type: TableTypeEnum
  seats:      number
  quantity:   number
  label:      string | null
}

interface ReservationSettings {
  id:                    string
  cafe_id:               string
  enabled:               boolean
  mode:                  ResModeType
  slot_duration_minutes: number
  tables:                CafeTableOut[]
  hours:                 DayHours[]
}

interface ReservationOut {
  id:               string
  table_id:         string
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
  status:           string
  table_seats:      number | null
  table_type:       string | null
  table_label:      string | null
}

interface Props {
  token: string
}

// ── Constants ─────────────────────────────────────────────────────────────

const DAYS = ['Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota','Niedziela']
const SLOT_OPTIONS = [15,30,45,60,90,120]
const TABLE_TYPE_LABELS: Record<TableTypeEnum, string> = {
  standard: 'Zwykły stolik',
  communal: 'Stół komunalny',
  special:  'Stolik specjalny',
}

function uid() { return Math.random().toString(36).slice(2) }

function defaultHours(): DayHours[] {
  return DAYS.map((_, i) => ({
    day_of_week: i,
    open_time:  i < 5 ? '08:00' : i === 5 ? '09:00' : null,
    close_time: i < 5 ? '20:00' : i === 5 ? '21:00' : null,
  }))
}

function tableTypeBadge(type: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    standard: { bg: '#EEF2FF', color: '#3730A3', label: 'standard' },
    communal: { bg: '#FEF9C3', color: '#854D0E', label: 'komunalny' },
    special:  { bg: '#FDF2F8', color: '#9D174D', label: 'specjalny' },
  }
  const s = map[type] ?? { bg: '#F3F4F6', color: '#374151', label: type }
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 100, padding: '1px 8px',
      fontSize: '0.68rem', fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
    }}>{s.label}</span>
  )
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ReservationTab({ token }: Props) {
  const [settings, setSettings]       = useState<ReservationSettings | null>(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  // draft state for settings editor
  const [enabled, setEnabled]         = useState(false)
  const [mode, setMode]               = useState<ResModeType>('simple')
  const [slotDuration, setSlotDuration] = useState(60)
  const [tables, setTables]           = useState<CafeTableDraft[]>([])
  const [hours, setHours]             = useState<DayHours[]>(defaultHours())
  const [settingsOpen, setSettingsOpen] = useState(false)

  // reservations view
  const [viewDate, setViewDate]       = useState(todayStr())
  const [reservations, setReservations] = useState<ReservationOut[]>([])
  const [loadingRes, setLoadingRes]   = useState(false)

  // add reservation modal
  const [showAddModal, setShowAddModal] = useState(false)

  // ── Fetch settings ───────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/reservations/settings', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data: ReservationSettings = await res.json()
        setSettings(data)
        setEnabled(data.enabled)
        setMode(data.mode as ResModeType)
        setSlotDuration(data.slot_duration_minutes)
        // Convert tables to drafts
        const drafts = groupTablesToDisplay(data.tables)
        setTables(drafts)
        const h = data.hours.length > 0 ? data.hours.map(x => ({
          day_of_week: x.day_of_week,
          open_time:  x.open_time,
          close_time: x.close_time,
        })) : defaultHours()
        // ensure all 7 days present
        const filled = DAYS.map((_, i) => h.find(d => d.day_of_week === i) ?? {
          day_of_week: i, open_time: null, close_time: null,
        })
        setHours(filled)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  // ── Fetch reservations ───────────────────────────────────────────────────

  const fetchReservations = useCallback(async (date: string) => {
    if (!settings?.enabled || settings.mode !== 'advanced') return
    setLoadingRes(true)
    try {
      const res = await fetch(
        `http://localhost:8000/reservations?date=${date}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (res.ok) {
        const data = await res.json()
        setReservations(data.reservations ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoadingRes(false) }
  }, [token, settings])

  useEffect(() => {
    if (settings?.enabled && settings.mode === 'advanced') {
      fetchReservations(viewDate)
    }
  }, [viewDate, fetchReservations, settings])

  // ── Save settings ────────────────────────────────────────────────────────

  const handleSaveSettings = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const body = {
        enabled,
        mode,
        slot_duration_minutes: slotDuration,
        tables: tablesForApi(tables),
        hours: hours.map(h => ({
          day_of_week: h.day_of_week,
          open_time:  h.open_time  || null,
          close_time: h.close_time || null,
        })),
      }
      const res = await fetch('http://localhost:8000/reservations/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Błąd zapisu.')
      }
      const data = await res.json()
      setSettings(data)
      setSaveMsg({ type: 'ok', text: 'Ustawienia zostały zapisane.' })
      setSettingsOpen(false)
    } catch (err: unknown) {
      setSaveMsg({ type: 'err', text: err instanceof Error ? err.message : 'Błąd zapisu.' })
    } finally { setSaving(false) }
  }

  // ── Delete reservation ───────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę rezerwację?')) return
    try {
      await fetch(`http://localhost:8000/reservations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setReservations(prev => prev.filter(r => r.id !== id))
    } catch { /* ignore */ }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <p>Wczytywanie ustawień rezerwacji…</p>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Nagłówek sekcji ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.25rem' }}>
            Zarządzanie
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
            Rezerwacje stolików
          </h2>
        </div>
        <button
          className="btn btn--primary"
          style={{ width: 'auto', padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
          onClick={() => { setSettingsOpen(true); setSaveMsg(null) }}
        >
          ⚙ Ustawienia rezerwacji
        </button>
      </div>

      {saveMsg && (
        <div className={saveMsg.type === 'ok' ? 'form-success' : 'form-error'}>
          {saveMsg.text}
        </div>
      )}

      {/* ── Rezerwacje wyłączone ─────────────────────────────────────────── */}
      {!settings?.enabled && (
        <div className="res-empty-card">
          <div className="res-empty-icon">📅</div>
          <div className="res-empty-title">System rezerwacji jest wyłączony</div>
          <div className="res-empty-sub">
            Włącz go w ustawieniach, by zacząć przyjmować rezerwacje.
          </div>
          <button
            className="btn btn--primary"
            style={{ width: 'auto', marginTop: '1rem' }}
            onClick={() => setSettingsOpen(true)}
          >
            Skonfiguruj rezerwacje
          </button>
        </div>
      )}

      {/* ── Tryb prosty ──────────────────────────────────────────────────── */}
      {settings?.enabled && settings.mode === 'simple' && (
        <div className="res-empty-card">
          <div className="res-empty-icon">🔧</div>
          <div className="res-empty-title">Prosty system rezerwacji</div>
          <div className="res-empty-sub">
            Funkcja prostego systemu rezerwacji jest w przygotowaniu.<br />
            Przełącz na tryb zaawansowany, by korzystać z pełnego zarządzania.
          </div>
        </div>
      )}

      {/* ── Tryb zaawansowany: podgląd dnia ─────────────────────────────── */}
      {settings?.enabled && settings.mode === 'advanced' && (
        <AdvancedView
          token={token}
          settings={settings}
          viewDate={viewDate}
          setViewDate={setViewDate}
          reservations={reservations}
          loadingRes={loadingRes}
          onDelete={handleDelete}
          onAdded={() => fetchReservations(viewDate)}
          showAddModal={showAddModal}
          setShowAddModal={setShowAddModal}
        />
      )}

      {/* ── Panel ustawień (slide-in) ────────────────────────────────────── */}
      {settingsOpen && (
        <SettingsPanel
          enabled={enabled}          setEnabled={setEnabled}
          mode={mode}                setMode={setMode}
          slotDuration={slotDuration} setSlotDuration={setSlotDuration}
          tables={tables}            setTables={setTables}
          hours={hours}              setHours={setHours}
          saving={saving}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SETTINGS PANEL
// ═════════════════════════════════════════════════════════════════════════════

function SettingsPanel({
  enabled, setEnabled, mode, setMode,
  slotDuration, setSlotDuration,
  tables, setTables, hours, setHours,
  saving, onSave, onClose,
}: {
  enabled: boolean; setEnabled: (v: boolean) => void
  mode: ResModeType; setMode: (v: ResModeType) => void
  slotDuration: number; setSlotDuration: (v: number) => void
  tables: CafeTableDraft[]; setTables: (v: CafeTableDraft[]) => void
  hours: DayHours[]; setHours: (v: DayHours[]) => void
  saving: boolean; onSave: () => void; onClose: () => void
}) {
  const addTable = (type: TableTypeEnum) => {
    setTables([...tables, {
      _uid: uid(), table_type: type,
      seats: type === 'communal' ? 10 : 2,
      quantity: 1, label: '',
    }])
  }

  const removeTable = (uid: string) => setTables(tables.filter(t => t._uid !== uid))

  const updateTable = (uid: string, patch: Partial<CafeTableDraft>) =>
    setTables(tables.map(t => t._uid === uid ? { ...t, ...patch } : t))

  const updateHours = (day: number, field: 'open_time'|'close_time', val: string|null) =>
    setHours(hours.map(h => h.day_of_week === day ? { ...h, [field]: val } : h))

  const toggleDay = (day: number, open: boolean) =>
    setHours(hours.map(h => h.day_of_week === day
      ? { ...h, open_time: open ? '08:00' : null, close_time: open ? '20:00' : null }
      : h))

  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor">
        {/* Header */}
        <div className="me-header">
          <div>
            <div className="me-eyebrow">Konfiguracja</div>
            <h2 className="me-title">Ustawienia rezerwacji</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>

        {/* Body */}
        <div className="me-body">

          {/* Włącznik główny */}
          <div className="res-settings-block">
            <div className="res-settings-block__title">System rezerwacji</div>
            <ToggleRow
              label="Przyjmuję rezerwacje stolików"
              checked={enabled}
              onChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              {/* Tryb */}
              <div className="res-settings-block">
                <div className="res-settings-block__title">Tryb systemu</div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {(['simple','advanced'] as ResModeType[]).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`res-mode-btn${mode === m ? ' res-mode-btn--active' : ''}`}
                    >
                      {m === 'simple' ? '🟡 Prosty' : '⚙ Zaawansowany'}
                    </button>
                  ))}
                </div>
                {mode === 'simple' && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Prosty system rezerwacji jest w przygotowaniu.
                  </p>
                )}
              </div>

              {mode === 'advanced' && (
                <>
                  {/* Czas slotu */}
                  <div className="res-settings-block">
                    <div className="res-settings-block__title">Czas rezerwacji</div>
                    <div className="field" style={{ maxWidth: 260 }}>
                      <label className="me-label">Czas między rezerwacjami</label>
                      <select
                        value={slotDuration}
                        onChange={e => setSlotDuration(Number(e.target.value))}
                        className="me-input"
                        style={{ cursor: 'pointer' }}
                      >
                        {SLOT_OPTIONS.map(s => (
                          <option key={s} value={s}>{s} minut</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Stoliki */}
                  <div className="res-settings-block">
                    <div className="res-settings-block__title">Stoliki</div>

                    {tables.length === 0 && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        Nie dodano jeszcze żadnych stolików.
                      </p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                      {tables.map(t => (
                        <div key={t._uid} className="res-table-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            {tableTypeBadge(t.table_type)}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', flex: 1 }}>
                              {TABLE_TYPE_LABELS[t.table_type]}
                            </span>
                            <button
                              type="button"
                              className="me-remove-btn me-remove-item"
                              onClick={() => removeTable(t._uid)}
                              title="Usuń"
                            >✕</button>
                          </div>

                          <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap' }}>
                            <div className="field" style={{ flex: '1 1 80px', minWidth: 80 }}>
                              <label className="me-label">Miejsca</label>
                              <input
                                type="number" min={1} max={50}
                                className="me-input"
                                value={t.seats}
                                onChange={e => updateTable(t._uid, { seats: Number(e.target.value) })}
                              />
                            </div>
                            {t.table_type === 'standard' && (
                              <div className="field" style={{ flex: '1 1 80px', minWidth: 80 }}>
                                <label className="me-label">Ilość</label>
                                <input
                                  type="number" min={1} max={100}
                                  className="me-input"
                                  value={t.quantity}
                                  onChange={e => updateTable(t._uid, { quantity: Number(e.target.value) })}
                                />
                              </div>
                            )}
                            {(t.table_type === 'special' || t.table_type === 'communal') && (
                              <div className="field" style={{ flex: '3 1 160px' }}>
                                <label className="me-label">
                                  {t.table_type === 'special' ? 'Co jest wyjątkowego?' : 'Opis (opcjonalnie)'}
                                </label>
                                <input
                                  type="text"
                                  className="me-input"
                                  placeholder={t.table_type === 'special' ? 'np. zamiast krzeseł są huśtawki' : ''}
                                  value={t.label}
                                  onChange={e => updateTable(t._uid, { label: e.target.value })}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(['standard','communal','special'] as TableTypeEnum[]).map(type => (
                        <button
                          key={type}
                          type="button"
                          className="me-add-item-btn"
                          style={{ width: 'auto', padding: '0.5rem 0.875rem', fontSize: '0.8rem' }}
                          onClick={() => addTable(type)}
                        >
                          + {type === 'standard' ? 'Zwykły stolik' : type === 'communal' ? 'Stół komunalny' : 'Stolik specjalny'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Godziny */}
                  <div className="res-settings-block">
                    <div className="res-settings-block__title">Godziny przyjmowania rezerwacji</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {hours.map(h => {
                        const isOpen = h.open_time !== null
                        return (
                          <div key={h.day_of_week} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
                            <div style={{ width: 110, fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)' }}>
                              {DAYS[h.day_of_week]}
                            </div>
                            <ToggleSmall
                              checked={isOpen}
                              onChange={v => toggleDay(h.day_of_week, v)}
                            />
                            {isOpen ? (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                  <input
                                    type="time" className="me-input res-time-input"
                                    value={h.open_time ?? ''}
                                    onChange={e => updateHours(h.day_of_week, 'open_time', e.target.value)}
                                  />
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>–</span>
                                  <input
                                    type="time" className="me-input res-time-input"
                                    value={h.close_time ?? ''}
                                    onChange={e => updateHours(h.day_of_week, 'close_time', e.target.value)}
                                  />
                                </div>
                              </>
                            ) : (
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Zamknięte</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="me-footer">
          <div className="me-footer-actions">
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>Anuluj</button>
            <button
              type="button"
              className="btn btn--primary"
              style={{ width: 'auto', minWidth: 160 }}
              onClick={onSave}
              disabled={saving}
            >
              {saving ? 'Zapisywanie…' : 'Zapisz ustawienia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ADVANCED VIEW – podgląd dnia
// ═════════════════════════════════════════════════════════════════════════════

function AdvancedView({
  token, settings, viewDate, setViewDate,
  reservations, loadingRes, onDelete, onAdded,
  showAddModal, setShowAddModal,
}: {
  token: string
  settings: ReservationSettings
  viewDate: string; setViewDate: (d: string) => void
  reservations: ReservationOut[]; loadingRes: boolean
  onDelete: (id: string) => void
  onAdded: () => void
  showAddModal: boolean; setShowAddModal: (v: boolean) => void
}) {
  const confirmed  = reservations.filter(r => r.status === 'confirmed')
  const cancelled  = reservations.filter(r => r.status === 'cancelled')

  const prevDay = () => {
    const d = new Date(viewDate); d.setDate(d.getDate() - 1)
    setViewDate(d.toISOString().slice(0, 10))
  }
  const nextDay = () => {
    const d = new Date(viewDate); d.setDate(d.getDate() + 1)
    setViewDate(d.toISOString().slice(0, 10))
  }

  const formatDate = (ds: string) => {
    const d = new Date(ds + 'T00:00:00')
    return d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <>
      {/* Info cards – podsumowanie stolików */}
      <div className="res-tables-summary">
        {groupForDisplay(settings.tables).map((grp, i) => (
          <div key={i} className="res-table-chip">
            {tableTypeBadge(grp.type)}
            <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.9rem' }}>
              {grp.count}× {grp.seats} os.
            </span>
            {grp.label && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{grp.label}</span>}
          </div>
        ))}
      </div>

      {/* Nawigacja po dacie */}
      <div className="res-day-nav">
        <button type="button" className="res-day-nav__btn" onClick={prevDay}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <input
            type="date"
            value={viewDate}
            onChange={e => setViewDate(e.target.value)}
            className="res-date-input"
          />
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', textTransform: 'capitalize' }}>
            {formatDate(viewDate)}
          </div>
        </div>
        <button type="button" className="res-day-nav__btn" onClick={nextDay}>›</button>
      </div>

      {/* Lista rezerwacji */}
      <div className="info-card">
        <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span className="info-card__icon">📋</span>
            <h2 className="info-card__title">Rezerwacje na ten dzień</h2>
            {!loadingRes && (
              <span style={{
                background: 'var(--border)', borderRadius: 100, padding: '1px 8px',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
              }}>{confirmed.length}</span>
            )}
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            style={{ width: 'auto' }}
            onClick={() => setShowAddModal(true)}
          >
            + Dodaj rezerwację
          </button>
        </div>

        <div style={{ padding: '0' }}>
          {loadingRes ? (
            <div className="loading-state" style={{ padding: '2rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : confirmed.length === 0 ? (
            <div className="menu-empty-state">
              <p>Brak rezerwacji na ten dzień.</p>
              <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                Kliknij „Dodaj rezerwację" aby wpisać rezerwację telefoniczną.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {confirmed.map(r => (
                <ReservationRow key={r.id} r={r} onDelete={onDelete} settings={settings} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Anulowane */}
      {cancelled.length > 0 && (
        <div className="info-card info-card--muted">
          <div className="info-card__header">
            <span className="info-card__icon">🚫</span>
            <h2 className="info-card__title">Anulowane ({cancelled.length})</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cancelled.map(r => (
              <ReservationRow key={r.id} r={r} onDelete={onDelete} settings={settings} cancelled />
            ))}
          </div>
        </div>
      )}

      {/* Modal dodawania */}
      {showAddModal && (
        <AddReservationModal
          token={token}
          settings={settings}
          date={viewDate}
          onClose={() => setShowAddModal(false)}
          onAdded={() => { setShowAddModal(false); onAdded() }}
        />
      )}
    </>
  )
}

// ── Reservation row ──────────────────────────────────────────────────────────

function ReservationRow({ r, onDelete, settings, cancelled = false }: {
  r: ReservationOut; onDelete: (id: string) => void
  settings: ReservationSettings; cancelled?: boolean
}) {
  const endMin   = toMinutes(r.start_time) + settings.slot_duration_minutes
  const endTime  = fromMinutes(endMin)
  const tableDesc = tableDescription(r)

  return (
    <div className={`res-row${cancelled ? ' res-row--cancelled' : ''}`}>
      <div className="res-row__time">
        <span className="res-row__start">{r.start_time}</span>
        <span className="res-row__end">–{endTime}</span>
      </div>
      <div className="res-row__main">
        <div className="res-row__header">
          <span className="res-row__name">{r.guest_name}</span>
          <span className="res-row__guests">
            {r.guests} {r.guests === 1 ? 'osoba' : r.guests < 5 ? 'osoby' : 'osób'}
          </span>
          {tableDesc && <span className="res-row__table">{tableDesc}</span>}
          {r.created_by_owner && <span className="res-row__tag res-row__tag--owner">telefon</span>}
          {r.client_id && <span className="res-row__tag res-row__tag--client">portal</span>}
        </div>
        {(r.guest_phone || r.guest_email) && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
            {r.guest_phone}{r.guest_phone && r.guest_email && ' · '}{r.guest_email}
          </div>
        )}
        {r.comment && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-body)', marginTop: '0.25rem', fontStyle: 'italic' }}>
            „{r.comment}"
          </div>
        )}
      </div>
      {!cancelled && (
        <button
          type="button"
          className="me-remove-btn me-remove-item"
          onClick={() => onDelete(r.id)}
          title="Usuń rezerwację"
          style={{ flexShrink: 0, alignSelf: 'flex-start', marginTop: '0.25rem' }}
        >✕</button>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ADD RESERVATION MODAL
// ═════════════════════════════════════════════════════════════════════════════

function AddReservationModal({ token, settings, date, onClose, onAdded }: {
  token: string; settings: ReservationSettings
  date: string; onClose: () => void; onAdded: () => void
}) {
  const [tableId, setTableId]     = useState(settings.tables[0]?.id ?? '')
  const [startTime, setStartTime] = useState('12:00')
  const [guests, setGuests]       = useState(2)
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [comment, setComment]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const selectedTable = settings.tables.find(t => t.id === tableId)

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim()) { setError('Podaj imię i nazwisko gościa.'); return }
    if (!tableId)     { setError('Wybierz stolik.'); return }

    setSaving(true)
    try {
      const res = await fetch('http://localhost:8000/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          table_id: tableId, date, start_time: startTime,
          guests, guest_name: name.trim(),
          guest_phone: phone.trim() || null,
          guest_email: email.trim() || null,
          comment: comment.trim() || null,
          client_id: null,
        }),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Błąd zapisu rezerwacji.')
      }
      onAdded()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu.')
    } finally { setSaving(false) }
  }

  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor" style={{ maxWidth: 520 }}>
        <div className="me-header">
          <div>
            <div className="me-eyebrow">Rezerwacja telefoniczna</div>
            <h2 className="me-title">Nowa rezerwacja</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose}>✕</button>
        </div>

        <div className="me-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Stolik */}
          <div className="field">
            <label className="me-label">Stolik</label>
            <select
              value={tableId}
              onChange={e => { setTableId(e.target.value); setGuests(1) }}
              className="me-input"
              style={{ cursor: 'pointer' }}
            >
              {settings.tables.map(t => (
                <option key={t.id} value={t.id}>
                  {tableTypeLabel(t.table_type)} · {t.seats} os.{t.label ? ` (${t.label})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Data + czas */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">Data</label>
              <input
                type="date" className="me-input"
                value={date} disabled
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">Godzina rozpoczęcia</label>
              <input
                type="time" className="me-input"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
              />
            </div>
          </div>

          {/* Liczba gości */}
          <div className="field" style={{ maxWidth: 160 }}>
            <label className="me-label">
              Liczba gości {selectedTable ? `(maks. ${selectedTable.seats})` : ''}
            </label>
            <input
              type="number" className="me-input"
              min={1} max={selectedTable?.seats ?? 50}
              value={guests}
              onChange={e => setGuests(Number(e.target.value))}
            />
          </div>

          {/* Dane gościa */}
          <div className="field">
            <label className="me-label">Imię i nazwisko gościa *</label>
            <input type="text" className="me-input" value={name}
              onChange={e => setName(e.target.value)} placeholder="Jan Kowalski" />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">Telefon</label>
              <input type="tel" className="me-input" value={phone}
                onChange={e => setPhone(e.target.value)} placeholder="+48 123 456 789" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">E-mail</label>
              <input type="email" className="me-input" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="jan@example.com" />
            </div>
          </div>
          <div className="field">
            <label className="me-label">Komentarz gościa</label>
            <input type="text" className="me-input" value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="np. urodziny, alergia, życzenie…" />
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="me-footer">
          <div className="me-footer-actions">
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>Anuluj</button>
            <button
              type="button"
              className="btn btn--primary"
              style={{ width: 'auto', minWidth: 160 }}
              onClick={handleSubmit} disabled={saving}
            >
              {saving ? 'Zapisywanie…' : 'Zapisz rezerwację'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SMALL HELPERS & PURE COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0' }}>
      <span style={{ fontSize: '0.9375rem', color: 'var(--text-dark)', fontWeight: 500 }}>{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--espresso)' : 'var(--border)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: checked ? 'var(--gold)' : '#fff',
        transition: 'left 0.2s, background 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function ToggleSmall({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--espresso)' : 'var(--border)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: checked ? 17 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: checked ? 'var(--gold)' : '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
      }} />
    </button>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(m: number): string {
  const hh = String(Math.floor(m / 60) % 24).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function tableTypeLabel(type: string) {
  return TABLE_TYPE_LABELS[type as TableTypeEnum] ?? type
}

function tableDescription(r: ReservationOut): string {
  if (!r.table_type) return ''
  const base = tableTypeLabel(r.table_type)
  if (r.table_label) return `${base} – ${r.table_label}`
  if (r.table_seats) return `${base} (${r.table_seats} os.)`
  return base
}

interface TableGroup {
  type: TableTypeEnum; seats: number; count: number; label: string | null
}

function groupForDisplay(tables: CafeTableOut[]): TableGroup[] {
  const map = new Map<string, TableGroup>()
  tables.forEach(t => {
    const key = `${t.table_type}-${t.seats}-${t.label ?? ''}`
    if (map.has(key)) { map.get(key)!.count++ }
    else map.set(key, { type: t.table_type, seats: t.seats, count: 1, label: t.label })
  })
  return Array.from(map.values())
}

function groupTablesToDisplay(tables: CafeTableOut[]): CafeTableDraft[] {
  // Group standard tables back into quantity-groups for the editor
  const groups: CafeTableDraft[] = []
  const std = tables.filter(t => t.table_type === 'standard')
  const others = tables.filter(t => t.table_type !== 'standard')

  const stdMap = new Map<string, { seats: number; count: number }>()
  std.forEach(t => {
    const key = String(t.seats)
    if (stdMap.has(key)) stdMap.get(key)!.count++
    else stdMap.set(key, { seats: t.seats, count: 1 })
  })
  stdMap.forEach(v =>
    groups.push({ _uid: uid(), table_type: 'standard', seats: v.seats, quantity: v.count, label: '' })
  )
  others.forEach(t =>
    groups.push({ _uid: uid(), table_type: t.table_type, seats: t.seats, quantity: 1, label: t.label ?? '' })
  )
  return groups
}

function tablesForApi(tables: CafeTableDraft[]): object[] {
  return tables.map(t => ({
    table_type: t.table_type,
    seats:      t.seats,
    quantity:   t.table_type === 'standard' ? t.quantity : 1,
    label:      t.label.trim() || null,
  }))
}