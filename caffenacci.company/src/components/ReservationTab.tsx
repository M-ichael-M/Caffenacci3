import { useState, useEffect, useCallback, useMemo } from 'react'
import SimpleReservationTab from './SimpleReservationTab'
import {
  Settings, CalendarDays, ClipboardList, Plus, X, Ban, CircleDot, SlidersHorizontal,
} from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'

type TFn = ReturnType<typeof useI18n>['t']

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
  owner_note:       string | null
  table_seats:      number | null
  table_type:       string | null
  table_label:      string | null
}

interface Props {
  token:  string
  cafeId: string
}

// ── Constants ─────────────────────────────────────────────────────────────

const DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6]   // 0 = poniedziałek … 6 = niedziela
const SLOT_OPTIONS = [15,30,45,60,90,120]

/** Nazwy dni tygodnia w języku panelu (1 stycznia 2024 to poniedziałek). */
function weekdayNames(locale: string): string[] {
  return DAY_INDEXES.map(i => {
    const s = new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'long' })
    return s.charAt(0).toLocaleUpperCase(locale) + s.slice(1)
  })
}

function uid() { return Math.random().toString(36).slice(2) }

function defaultHours(): DayHours[] {
  return DAY_INDEXES.map(i => ({
    day_of_week: i,
    open_time:  i < 5 ? '08:00' : i === 5 ? '09:00' : null,
    close_time: i < 5 ? '20:00' : i === 5 ? '21:00' : null,
  }))
}

function tableTypeLabel(t: TFn, type: string) {
  return ['standard', 'communal', 'special'].includes(type) ? t(`res.table.${type}`) : type
}

function tableTypeBadge(t: TFn, type: string) {
  const map: Record<string, { bg: string; color: string }> = {
    standard: { bg: '#EEF2FF', color: '#3730A3' },
    communal: { bg: '#FBEED2', color: '#7A4E12' },
    special:  { bg: '#FDF0F7', color: '#9D174D' },
  }
  const s = map[type] ?? { bg: 'var(--surface-2)', color: 'var(--text-body)' }
  return (
    <span style={{
      background: s.bg, color: s.color,
      borderRadius: 100, padding: '1px 8px',
      fontSize: '0.68rem', fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
    }}>{map[type] ? t(`res.tableBadge.${type}`) : type}</span>
  )
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ReservationTab({ token, cafeId }: Props) {
  const { t, tApi, locale } = useI18n()
  const dayNames = useMemo(() => weekdayNames(locale), [locale])

  const [settings, setSettings]       = useState<ReservationSettings | null>(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState<{ type: 'ok'|'err'; text: string } | null>(null)

  const [enabled, setEnabled]         = useState(false)
  const [mode, setMode]               = useState<ResModeType>('simple')
  const [slotDuration, setSlotDuration] = useState(60)
  const [tables, setTables]           = useState<CafeTableDraft[]>([])
  const [hours, setHours]             = useState<DayHours[]>(defaultHours())
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [viewDate, setViewDate]       = useState(todayStr())
  const [reservations, setReservations] = useState<ReservationOut[]>([])
  const [loadingRes, setLoadingRes]   = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  // ── Fetch settings ───────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/reservations/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data: ReservationSettings = await res.json()
        setSettings(data)
        setEnabled(data.enabled)
        setMode(data.mode as ResModeType)
        setSlotDuration(data.slot_duration_minutes)
        const drafts = groupTablesToDisplay(data.tables)
        setTables(drafts)
        const h = data.hours.length > 0 ? data.hours.map(x => ({
          day_of_week: x.day_of_week,
          open_time:  x.open_time,
          close_time: x.close_time,
        })) : defaultHours()
        const filled = DAY_INDEXES.map(i => h.find(d => d.day_of_week === i) ?? {
          day_of_week: i, open_time: null, close_time: null,
        })
        setHours(filled)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  // ── Fetch reservations (advanced) ────────────────────────────────────────

  const fetchReservations = useCallback(async (date: string) => {
    if (!settings?.enabled || settings.mode !== 'advanced') return
    setLoadingRes(true)
    try {
      const res = await fetch(
        `${API_URL}/reservations?date=${date}`,
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
      const res = await fetch(`${API_URL}/reservations/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => null)
        setSaveMsg({ type: 'err', text: tApi(e?.detail, 'res.err.save') })
        return
      }
      const data = await res.json()
      setSettings(data)
      setSaveMsg({ type: 'ok', text: t('res.saved') })
      setSettingsOpen(false)
    } catch {
      setSaveMsg({ type: 'err', text: t('common.genericError') })
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('res.delete.confirm'))) return
    try {
      await fetch(`${API_URL}/reservations/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchReservations(viewDate)
    } catch { /* ignore */ }
  }

  if (loading) return (
    <div className="loading-state">
      <div className="loading-spinner" />
      <p>{t('res.loading')}</p>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Nagłówek ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="page-header__eyebrow" style={{ marginBottom: '0.25rem' }}>
            {t('common.management')}
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
            {t('res.title')}
          </h2>
        </div>
        <button
          className="btn btn--primary"
          style={{ width: 'auto', padding: '0.625rem 1.25rem', fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => { setSettingsOpen(true); setSaveMsg(null) }}
        >
          <Settings size={17} />
          {t('res.settingsBtn')}
        </button>
      </div>

      {saveMsg && (
        <div className={saveMsg.type === 'ok' ? 'form-success' : 'form-error'}>
          {saveMsg.text}
        </div>
      )}

      {/* ── Wyłączone ────────────────────────────────────────────────────── */}
      {!settings?.enabled && (
        <div className="res-empty-card">
          <div className="res-empty-icon"><CalendarDays size={44} strokeWidth={1.4} /></div>
          <div className="res-empty-title">{t('res.disabled.title')}</div>
          <div className="res-empty-sub">{t('res.disabled.sub')}</div>
          <button
            className="btn btn--primary"
            style={{ width: 'auto', marginTop: '1rem' }}
            onClick={() => setSettingsOpen(true)}
          >
            {t('res.disabled.cta')}
          </button>
        </div>
      )}

      {/* ── Tryb SIMPLE — nowy panel zarządzania ─────────────────────────── */}
      {settings?.enabled && settings.mode === 'simple' && (
        <SimpleReservationTab token={token} cafeId={cafeId} />
      )}

      {/* ── Tryb ADVANCED ────────────────────────────────────────────────── */}
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

      {/* ── Panel ustawień ───────────────────────────────────────────────── */}
      {settingsOpen && (
        <SettingsPanel
          dayNames={dayNames}
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
  dayNames, enabled, setEnabled, mode, setMode,
  slotDuration, setSlotDuration,
  tables, setTables, hours, setHours,
  saving, onSave, onClose,
}: {
  dayNames: string[]
  enabled: boolean; setEnabled: (v: boolean) => void
  mode: ResModeType; setMode: (v: ResModeType) => void
  slotDuration: number; setSlotDuration: (v: number) => void
  tables: CafeTableDraft[]; setTables: (v: CafeTableDraft[]) => void
  hours: DayHours[]; setHours: (v: DayHours[]) => void
  saving: boolean; onSave: () => void; onClose: () => void
}) {
  const { t } = useI18n()

  const addTable = (type: TableTypeEnum) => {
    setTables([...tables, {
      _uid: uid(), table_type: type,
      seats: type === 'communal' ? 10 : 2,
      quantity: 1, label: '',
    }])
  }

  const removeTable = (id: string) => setTables(tables.filter(x => x._uid !== id))

  const updateTable = (id: string, patch: Partial<CafeTableDraft>) =>
    setTables(tables.map(x => x._uid === id ? { ...x, ...patch } : x))

  const updateHours = (day: number, field: 'open_time'|'close_time', val: string|null) =>
    setHours(hours.map(h => h.day_of_week === day ? { ...h, [field]: val } : h))

  const toggleDay = (day: number, open: boolean) =>
    setHours(hours.map(h => h.day_of_week === day
      ? { ...h, open_time: open ? '08:00' : null, close_time: open ? '20:00' : null }
      : h))

  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor">
        <div className="me-header">
          <div>
            <div className="me-eyebrow">{t('res.settings.eyebrow')}</div>
            <h2 className="me-title">{t('res.settingsBtn')}</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label={t('common.close')}><X size={16} /></button>
        </div>

        <div className="me-body">
          <div className="res-settings-block">
            <div className="res-settings-block__title">{t('res.settings.block.system')}</div>
            <ToggleRow
              label={t('res.settings.accept')}
              checked={enabled}
              onChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              <div className="res-settings-block">
                <div className="res-settings-block__title">{t('res.settings.block.mode')}</div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setMode('simple')}
                    className={`res-mode-btn${mode === 'simple' ? ' res-mode-btn--active' : ''}`}
                  >
                    <CircleDot size={16} />
                    {t('res.mode.simple')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('advanced')}
                    className={`res-mode-btn${mode === 'advanced' ? ' res-mode-btn--active' : ''}`}
                  >
                    <SlidersHorizontal size={16} />
                    {t('res.mode.advanced')}
                  </button>
                </div>
                {mode === 'simple' && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.625rem', lineHeight: 1.6 }}>
                    {t('res.mode.simpleDesc')}
                  </p>
                )}
              </div>

              {mode === 'advanced' && (
                <>
                  <div className="res-settings-block">
                    <div className="res-settings-block__title">{t('res.settings.block.slot')}</div>
                    <div className="field" style={{ maxWidth: 260 }}>
                      <label className="me-label">{t('res.settings.slotLabel')}</label>
                      <select
                        value={slotDuration}
                        onChange={e => setSlotDuration(Number(e.target.value))}
                        className="me-input"
                        style={{ cursor: 'pointer' }}
                      >
                        {SLOT_OPTIONS.map(s => (
                          <option key={s} value={s}>{t('res.minutes', { count: s })}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="res-settings-block">
                    <div className="res-settings-block__title">{t('res.settings.block.tables')}</div>
                    {tables.length === 0 && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        {t('res.tables.none')}
                      </p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                      {tables.map(tb => (
                        <div key={tb._uid} className="res-table-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            {tableTypeBadge(t, tb.table_type)}
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', flex: 1 }}>
                              {tableTypeLabel(t, tb.table_type)}
                            </span>
                            <button type="button" className="me-remove-btn me-remove-item" onClick={() => removeTable(tb._uid)} title={t('res.table.remove')} aria-label={t('res.table.remove')}>
                              <X size={13} />
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap' }}>
                            <div className="field" style={{ flex: '1 1 80px', minWidth: 80 }}>
                              <label className="me-label">{t('res.table.seats')}</label>
                              <input type="number" min={1} max={50} className="me-input" value={tb.seats}
                                onChange={e => updateTable(tb._uid, { seats: Number(e.target.value) })} />
                            </div>
                            {tb.table_type === 'standard' && (
                              <div className="field" style={{ flex: '1 1 80px', minWidth: 80 }}>
                                <label className="me-label">{t('res.table.quantity')}</label>
                                <input type="number" min={1} max={100} className="me-input" value={tb.quantity}
                                  onChange={e => updateTable(tb._uid, { quantity: Number(e.target.value) })} />
                              </div>
                            )}
                            {(tb.table_type === 'special' || tb.table_type === 'communal') && (
                              <div className="field" style={{ flex: '3 1 160px' }}>
                                <label className="me-label">
                                  {tb.table_type === 'special' ? t('res.table.special.label') : t('res.table.communal.label')}
                                </label>
                                <input type="text" className="me-input"
                                  placeholder={tb.table_type === 'special' ? t('res.table.special.placeholder') : ''}
                                  value={tb.label}
                                  onChange={e => updateTable(tb._uid, { label: e.target.value })} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {(['standard','communal','special'] as TableTypeEnum[]).map(type => (
                        <button key={type} type="button" className="me-add-item-btn"
                          style={{ width: 'auto', padding: '0.5rem 0.875rem', fontSize: '0.8rem' }}
                          onClick={() => addTable(type)}>
                          <Plus size={14} />
                          {t(`res.table.${type}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="res-settings-block">
                    <div className="res-settings-block__title">{t('res.settings.block.hours')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {hours.map(h => {
                        const isOpen = h.open_time !== null
                        return (
                          <div key={h.day_of_week} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
                            <div style={{ width: 110, fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)' }}>
                              {dayNames[h.day_of_week]}
                            </div>
                            <ToggleSmall checked={isOpen} onChange={v => toggleDay(h.day_of_week, v)} />
                            {isOpen ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <input type="time" className="me-input res-time-input"
                                  value={h.open_time ?? ''}
                                  onChange={e => updateHours(h.day_of_week, 'open_time', e.target.value)} />
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>–</span>
                                <input type="time" className="me-input res-time-input"
                                  value={h.close_time ?? ''}
                                  onChange={e => updateHours(h.day_of_week, 'close_time', e.target.value)} />
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t('res.closed')}</span>
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

        <div className="me-footer">
          <div className="me-footer-actions">
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>{t('common.cancel')}</button>
            <button type="button" className="btn btn--primary" style={{ width: 'auto', minWidth: 160 }}
              onClick={onSave} disabled={saving}>
              {saving ? t('common.saving') : t('res.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ADVANCED VIEW
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
  const { t, locale } = useI18n()
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
    return d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <>
      <div className="res-tables-summary">
        {groupForDisplay(settings.tables).map((grp, i) => (
          <div key={i} className="res-table-chip">
            {tableTypeBadge(t, grp.type)}
            <span style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.9rem' }}>
              {t('res.tableChip', { count: grp.count, seats: grp.seats })}
            </span>
            {grp.label && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} translate="no">{grp.label}</span>}
          </div>
        ))}
      </div>

      <div className="res-day-nav">
        <button type="button" className="res-day-nav__btn" onClick={prevDay}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <input type="date" value={viewDate}
            onChange={e => setViewDate(e.target.value)} className="res-date-input" />
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', textTransform: 'capitalize' }}>
            {formatDate(viewDate)}
          </div>
        </div>
        <button type="button" className="res-day-nav__btn" onClick={nextDay}>›</button>
      </div>

      <div className="info-card">
        <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span className="info-card__icon"><ClipboardList size={20} /></span>
            <h2 className="info-card__title">{t('res.dayReservations')}</h2>
            {!loadingRes && (
              <span style={{
                background: 'var(--border-soft)', borderRadius: 100, padding: '1px 8px',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)',
              }}>{confirmed.length}</span>
            )}
          </div>
          <button type="button" className="btn btn--primary btn--sm"
            style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }} onClick={() => setShowAddModal(true)}>
            <Plus size={15} />
            {t('res.add')}
          </button>
        </div>

        <div>
          {loadingRes ? (
            <div className="loading-state" style={{ padding: '2rem' }}>
              <div className="loading-spinner" />
            </div>
          ) : confirmed.length === 0 ? (
            <div className="menu-empty-state">
              <p>{t('res.dayEmpty')}</p>
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

      {cancelled.length > 0 && (
        <div className="info-card info-card--muted">
          <div className="info-card__header">
            <span className="info-card__icon"><Ban size={20} /></span>
            <h2 className="info-card__title">{t('res.cancelledTitle', { count: cancelled.length })}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {cancelled.map(r => (
              <ReservationRow key={r.id} r={r} onDelete={onDelete} settings={settings} cancelled />
            ))}
          </div>
        </div>
      )}

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

// ── Reservation row (advanced) ────────────────────────────────────────────────

function ReservationRow({ r, onDelete, settings, cancelled = false }: {
  r: ReservationOut; onDelete: (id: string) => void
  settings: ReservationSettings; cancelled?: boolean
}) {
  const { t } = useI18n()
  const endMin  = toMinutes(r.start_time) + settings.slot_duration_minutes
  const endTime = fromMinutes(endMin)

  const tableDesc = (() => {
    if (!r.table_type) return ''
    const base = tableTypeLabel(t, r.table_type)
    if (r.table_label) return `${base} – ${r.table_label}`
    if (r.table_seats) return t('res.tableDesc.seats', { type: base, seats: r.table_seats })
    return base
  })()

  return (
    <div className={`res-row${cancelled ? ' res-row--cancelled' : ''}`}>
      <div className="res-row__time">
        <span className="res-row__start">{r.start_time}</span>
        <span className="res-row__end">–{endTime}</span>
      </div>
      <div className="res-row__main">
        <div className="res-row__header">
          <span className="res-row__name" translate="no">{r.guest_name}</span>
          <span className="res-row__guests">{t('res.guests', { count: r.guests })}</span>
          {tableDesc && <span className="res-row__table" translate="no">{tableDesc}</span>}
          {r.created_by_owner && <span className="res-row__tag res-row__tag--owner">{t('res.tag.phone')}</span>}
          {r.client_id && <span className="res-row__tag res-row__tag--client">{t('res.tag.portal')}</span>}
        </div>
        {(r.guest_phone || r.guest_email) && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }} translate="no">
            {r.guest_phone}{r.guest_phone && r.guest_email && ' · '}{r.guest_email}
          </div>
        )}
        {r.comment && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-body)', marginTop: '0.25rem', fontStyle: 'italic' }} translate="no">
            {t('common.quoted', { text: r.comment })}
          </div>
        )}
      </div>
      {!cancelled && (
        <button type="button" className="me-remove-btn me-remove-item"
          onClick={() => onDelete(r.id)} title={t('res.row.delete')} aria-label={t('res.row.delete')}
          style={{ flexShrink: 0, alignSelf: 'flex-start', marginTop: '0.25rem' }}>
          <X size={13} />
        </button>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// ADD RESERVATION MODAL (advanced)
// ═════════════════════════════════════════════════════════════════════════════

function AddReservationModal({ token, settings, date, onClose, onAdded }: {
  token: string; settings: ReservationSettings
  date: string; onClose: () => void; onAdded: () => void
}) {
  const { t, tApi } = useI18n()
  const [tableId, setTableId]     = useState(settings.tables[0]?.id ?? '')
  const [startTime, setStartTime] = useState('12:00')
  const [guests, setGuests]       = useState(2)
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [comment, setComment]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const selectedTable = settings.tables.find(x => x.id === tableId)

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim()) { setError(t('res.modal.err.name')); return }
    if (!tableId)     { setError(t('res.modal.err.table')); return }

    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/reservations`, {
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
        const e = await res.json().catch(() => null)
        setError(tApi(e?.detail, 'res.modal.err.save'))
        return
      }
      onAdded()
    } catch {
      setError(t('common.genericError'))
    } finally { setSaving(false) }
  }

  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor" style={{ maxWidth: 520 }}>
        <div className="me-header">
          <div>
            <div className="me-eyebrow">{t('res.modal.eyebrow')}</div>
            <h2 className="me-title">{t('res.modal.title')}</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label={t('common.close')}><X size={16} /></button>
        </div>

        <div className="me-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="field">
            <label className="me-label">{t('res.modal.table')}</label>
            <select value={tableId} onChange={e => { setTableId(e.target.value); setGuests(1) }}
              className="me-input" style={{ cursor: 'pointer' }}>
              {settings.tables.map(tb => (
                <option key={tb.id} value={tb.id}>
                  {tableTypeLabel(t, tb.table_type)} · {t('res.seatsShort', { seats: tb.seats })}{tb.label ? ` (${tb.label})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">{t('res.modal.date')}</label>
              <input type="date" className="me-input" value={date} disabled />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">{t('res.modal.time')}</label>
              <input type="time" className="me-input" value={startTime}
                onChange={e => setStartTime(e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ maxWidth: 200 }}>
            <label className="me-label">
              {selectedTable ? t('res.modal.guestsMax', { max: selectedTable.seats }) : t('res.modal.guests')}
            </label>
            <input type="number" className="me-input" min={1} max={selectedTable?.seats ?? 50}
              value={guests} onChange={e => setGuests(Number(e.target.value))} />
          </div>

          <div className="field">
            <label className="me-label">{t('res.modal.name')}</label>
            <input type="text" className="me-input" value={name}
              onChange={e => setName(e.target.value)} placeholder="Jan Kowalski" />
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">{t('res.modal.phone')}</label>
              <input type="tel" className="me-input" value={phone}
                onChange={e => setPhone(e.target.value)} placeholder="+48 123 456 789" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="me-label">{t('res.modal.email')}</label>
              <input type="email" className="me-input" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="jan@example.com" />
            </div>
          </div>
          <div className="field">
            <label className="me-label">{t('res.modal.comment')}</label>
            <input type="text" className="me-input" value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t('res.modal.commentPlaceholder')} />
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="me-footer">
          <div className="me-footer-actions">
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>{t('common.cancel')}</button>
            <button type="button" className="btn btn--primary"
              style={{ width: 'auto', minWidth: 160 }}
              onClick={handleSubmit} disabled={saving}>
              {saving ? t('common.saving') : t('res.modal.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// SMALL HELPERS
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
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--espresso)' : 'var(--border)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}>
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

function ToggleSmall({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{
        width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--espresso)' : 'var(--border)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}>
      <span style={{
        position: 'absolute', top: 2, left: checked ? 17 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: checked ? 'var(--gold-soft)' : '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
      }} />
    </button>
  )
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

interface TableGroup {
  type: TableTypeEnum; seats: number; count: number; label: string | null
}

function groupForDisplay(tables: CafeTableOut[]): TableGroup[] {
  const map = new Map<string, TableGroup>()
  tables.forEach(tb => {
    const key = `${tb.table_type}-${tb.seats}-${tb.label ?? ''}`
    if (map.has(key)) { map.get(key)!.count++ }
    else map.set(key, { type: tb.table_type, seats: tb.seats, count: 1, label: tb.label })
  })
  return Array.from(map.values())
}

function groupTablesToDisplay(tables: CafeTableOut[]): CafeTableDraft[] {
  const groups: CafeTableDraft[] = []
  const std = tables.filter(x => x.table_type === 'standard')
  const others = tables.filter(x => x.table_type !== 'standard')

  const stdMap = new Map<string, { seats: number; count: number }>()
  std.forEach(x => {
    const key = String(x.seats)
    if (stdMap.has(key)) stdMap.get(key)!.count++
    else stdMap.set(key, { seats: x.seats, count: 1 })
  })
  stdMap.forEach(v =>
    groups.push({ _uid: uid(), table_type: 'standard', seats: v.seats, quantity: v.count, label: '' })
  )
  others.forEach(x =>
    groups.push({ _uid: uid(), table_type: x.table_type, seats: x.seats, quantity: 1, label: x.label ?? '' })
  )
  return groups
}

function tablesForApi(tables: CafeTableDraft[]): object[] {
  return tables.map(x => ({
    table_type: x.table_type,
    seats:      x.seats,
    quantity:   x.table_type === 'standard' ? x.quantity : 1,
    label:      x.label.trim() || null,
  }))
}