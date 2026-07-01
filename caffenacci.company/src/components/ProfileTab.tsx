import { useState, useEffect, useCallback, useRef } from 'react'
import LocationPicker from './LocationPicker'

// ── Types ─────────────────────────────────────────────────────────────────

interface WeeklyHours {
  day_of_week: number
  open_time:   string | null
  close_time:  string | null
}

interface HourException {
  id?:        string
  date:       string
  is_closed:  boolean
  open_time:  string | null
  close_time: string | null
}

interface SocialLink {
  id?:       string
  platform:  string
  url:       string
  label:     string | null
  visible:   boolean
  position:  number
}

interface Employee {
  id?:       string
  full_name: string
  role:      string
  bio:       string | null
  visible:   boolean
  position:  number
}

interface CafeProfileData {
  id: string
  cafe_id: string
  owner_name: string
  email: string
  phone: string
  cafe_name: string
  country: string
  city: string
  street: string
  building_number: string
  postal_code: string
  contact_email: string | null
  contact_email_visible: boolean
  contact_phone: string | null
  contact_phone_visible: boolean
  description: string | null
  description_visible: boolean
  latitude: number | null
  longitude: number | null
  location_visible: boolean
  location_show_map: boolean
  location_show_gmaps_link: boolean
  logo_url: string | null
  logo_complete: boolean
  weekly_hours: WeeklyHours[]
  hour_exceptions: HourException[]
  social_links: SocialLink[]
  employees: Employee[]
  profile_complete: boolean
  updated_at: string | null
}

interface Props {
  token: string
}

// ── Constants ─────────────────────────────────────────────────────────────

const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']
const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram', icon: '📷' },
  { value: 'facebook',  label: 'Facebook',  icon: '📘' },
  { value: 'x',         label: 'X (Twitter)', icon: '✕' },
  { value: 'tiktok',    label: 'TikTok',    icon: '🎵' },
  { value: 'other',     label: 'Inny',      icon: '🔗' },
]
const MAX_EXCEPTION_DAYS_AHEAD = 21

function uid() { return Math.random().toString(36).slice(2) }

function defaultWeeklyHours(): WeeklyHours[] {
  return DAYS.map((_, i) => ({
    day_of_week: i,
    open_time:  i < 5 ? '08:00' : i === 5 ? '09:00' : null,
    close_time: i < 5 ? '20:00' : i === 5 ? '21:00' : null,
  }))
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function platformMeta(platform: string) {
  return PLATFORM_OPTIONS.find(p => p.value === platform) ?? PLATFORM_OPTIONS[4]
}

// ═════════════════════════════════════════════════════════════════════════════
// SMALL UI HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--espresso)' : 'var(--border)',
        opacity: disabled ? 0.5 : 1,
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 20 : 3,
        width: 16, height: 16, borderRadius: '50%',
        background: checked ? 'var(--gold)' : '#fff',
        transition: 'left 0.2s, background 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function VisibilityBadge({ visible, alwaysPublic = false }: { visible: boolean; alwaysPublic?: boolean }) {
  if (alwaysPublic) {
    return <span className="pf-badge pf-badge--public">zawsze publiczne</span>
  }
  return visible
    ? <span className="pf-badge pf-badge--public">publiczne</span>
    : <span className="pf-badge pf-badge--private">prywatne</span>
}

function SectionCard({ title, eyebrow, badge, children }: {
  title: string; eyebrow: string; badge?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="info-card">
      <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
            {eyebrow}
          </div>
          <h2 className="info-card__title" style={{ textTransform: 'none', fontSize: '0.9375rem', marginTop: '0.125rem' }}>
            {title}
          </h2>
        </div>
        {badge}
      </div>
      <div className="info-card__body">{children}</div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function ProfileTab({ token }: Props) {
  const [profile, setProfile]   = useState<CafeProfileData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Draft state — edytowalna kopia profilu
  const [ownerName, setOwnerName]   = useState('')
  const [phone, setPhone]           = useState('')
  const [cafeName, setCafeName]     = useState('')
  const [country, setCountry]       = useState('')
  const [city, setCity]             = useState('')
  const [street, setStreet]         = useState('')
  const [buildingNumber, setBuildingNumber] = useState('')
  const [postalCode, setPostalCode] = useState('')

  const [contactEmail, setContactEmail]               = useState('')
  const [contactEmailVisible, setContactEmailVisible] = useState(false)
  const [contactPhone, setContactPhone]               = useState('')
  const [contactPhoneVisible, setContactPhoneVisible] = useState(false)

  const [description, setDescription]               = useState('')
  const [descriptionVisible, setDescriptionVisible] = useState(false)

  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours[]>(defaultWeeklyHours())
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])
  const [employees, setEmployees]     = useState<Employee[]>([])

  const [logoUrl, setLogoUrl]           = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError]       = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exceptions, setExceptions]     = useState<HourException[]>([])
  const [exceptionsLoading, setExceptionsLoading] = useState(false)

  // Lokalizacja na mapie
  const [latitude, setLatitude]   = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locationVisible, setLocationVisible]             = useState(false)
  const [locationShowMap, setLocationShowMap]             = useState(true)
  const [locationShowGmapsLink, setLocationShowGmapsLink] = useState(true)

  // ── Fetch ───────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8000/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data: CafeProfileData = await res.json()
        setProfile(data)
        setOwnerName(data.owner_name)
        setPhone(data.phone)
        setCafeName(data.cafe_name)
        setCountry(data.country)
        setCity(data.city)
        setStreet(data.street)
        setBuildingNumber(data.building_number)
        setPostalCode(data.postal_code)
        setContactEmail(data.contact_email ?? '')
        setContactEmailVisible(data.contact_email_visible)
        setContactPhone(data.contact_phone ?? '')
        setContactPhoneVisible(data.contact_phone_visible)
        setDescription(data.description ?? '')
        setDescriptionVisible(data.description_visible)
        setWeeklyHours(data.weekly_hours.length === 7 ? data.weekly_hours : defaultWeeklyHours())
        setSocialLinks(data.social_links)
        setEmployees(data.employees)
        setLogoUrl(data.logo_url)
        setExceptions(data.hour_exceptions)
        setLatitude(data.latitude ?? null)
        setLongitude(data.longitude ?? null)
        setLocationVisible(data.location_visible)
        setLocationShowMap(data.location_show_map)
        setLocationShowGmapsLink(data.location_show_gmaps_link)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // ── Logo upload ─────────────────────────────────────────────────────────

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    setLogoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('http://localhost:8000/profile/logo', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Błąd wgrywania logo.')
      }
      const data: CafeProfileData = await res.json()
      setLogoUrl(data.logo_url)
      setProfile(data)
    } catch (err: unknown) {
      setLogoError(err instanceof Error ? err.message : 'Wystąpił błąd. Spróbuj ponownie.')
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleLogoDelete = async () => {
    if (!confirm('Czy na pewno chcesz usunąć logo?')) return
    try {
      const res = await fetch('http://localhost:8000/profile/logo', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data: CafeProfileData = await res.json()
        setLogoUrl(null)
        setProfile(data)
      }
    } catch { /* ignore */ }
  }

  // ── Weekly hours mutations ───────────────────────────────────────────────

  const toggleDay = (day: number, open: boolean) =>
    setWeeklyHours(prev => prev.map(h => h.day_of_week === day
      ? { ...h, open_time: open ? '08:00' : null, close_time: open ? '20:00' : null }
      : h))

  const updateHours = (day: number, field: 'open_time' | 'close_time', val: string) =>
    setWeeklyHours(prev => prev.map(h => h.day_of_week === day ? { ...h, [field]: val } : h))

  // ── Exceptions mutations ─────────────────────────────────────────────────

  const maxExceptionDate = (() => {
    const d = new Date()
    d.setDate(d.getDate() + MAX_EXCEPTION_DAYS_AHEAD)
    return d.toISOString().slice(0, 10)
  })()

  const saveException = async (exc: HourException) => {
    setExceptionsLoading(true)
    try {
      const res = await fetch(`http://localhost:8000/profile/hour-exceptions/${exc.date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(exc),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Błąd zapisu wyjątku.')
      }
      const saved: HourException = await res.json()
      setExceptions(prev => {
        const exists = prev.find(x => x.date === saved.date)
        return exists ? prev.map(x => x.date === saved.date ? saved : x) : [...prev, saved]
      })
    } catch (err: unknown) {
      setSaveMsg({ type: 'err', text: err instanceof Error ? err.message : 'Błąd zapisu wyjątku.' })
    } finally { setExceptionsLoading(false) }
  }

  const deleteException = async (date: string) => {
    setExceptionsLoading(true)
    try {
      await fetch(`http://localhost:8000/profile/hour-exceptions/${date}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setExceptions(prev => prev.filter(x => x.date !== date))
    } catch { /* ignore */ }
    finally { setExceptionsLoading(false) }
  }

  // ── Social links mutations ───────────────────────────────────────────────

  const addSocialLink = () => setSocialLinks(prev => [
    ...prev, { _uid: uid(), platform: 'instagram', url: '', label: '', visible: true, position: prev.length } as unknown as SocialLink,
  ])
  const updateSocialLink = (idx: number, patch: Partial<SocialLink>) =>
    setSocialLinks(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  const removeSocialLink = (idx: number) =>
    setSocialLinks(prev => prev.filter((_, i) => i !== idx))

  // ── Employees mutations ──────────────────────────────────────────────────

  const addEmployee = () => setEmployees(prev => [
    ...prev, { full_name: '', role: '', bio: '', visible: true, position: prev.length },
  ])
  const updateEmployee = (idx: number, patch: Partial<Employee>) =>
    setEmployees(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e))
  const removeEmployee = (idx: number) =>
    setEmployees(prev => prev.filter((_, i) => i !== idx))

  // ── Location mutations ───────────────────────────────────────────────────

  const handlePositionChange = (lat: number, lng: number) => {
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      // Sygnał kasowania pinezki z LocationPicker
      setLatitude(null)
      setLongitude(null)
      setLocationVisible(false)
      return
    }
    setLatitude(lat)
    setLongitude(lng)
  }

  // ── Save full profile ────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const body = {
        owner_name: ownerName,
        phone,
        cafe_name: cafeName,
        country, city, street,
        building_number: buildingNumber,
        postal_code: postalCode,
        contact_email: contactEmail.trim() || null,
        contact_email_visible: contactEmailVisible,
        contact_phone: contactPhone.trim() || null,
        contact_phone_visible: contactPhoneVisible,
        description: description.trim() || null,
        description_visible: descriptionVisible,
        latitude,
        longitude,
        location_visible: locationVisible,
        location_show_map: locationShowMap,
        location_show_gmaps_link: locationShowGmapsLink,
        weekly_hours: weeklyHours,
        social_links: socialLinks
          .filter(s => s.url.trim())
          .map((s, i) => ({ platform: s.platform, url: s.url.trim(), label: s.label?.trim() || null, visible: s.visible, position: i })),
        employees: employees
          .filter(e => e.full_name.trim() && e.role.trim())
          .map((e, i) => ({ full_name: e.full_name.trim(), role: e.role.trim(), bio: e.bio?.trim() || null, visible: e.visible, position: i })),
      }
      const res = await fetch('http://localhost:8000/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const e = await res.json()
        throw new Error(e.detail || 'Błąd zapisu profilu.')
      }
      const data: CafeProfileData = await res.json()
      setProfile(data)
      setSocialLinks(data.social_links)
      setEmployees(data.employees)
      setLatitude(data.latitude ?? null)
      setLongitude(data.longitude ?? null)
      setLocationVisible(data.location_visible)
      setLocationShowMap(data.location_show_map)
      setLocationShowGmapsLink(data.location_show_gmaps_link)
      setSaveMsg({ type: 'ok', text: 'Profil kawiarni został zapisany.' })
    } catch (err: unknown) {
      setSaveMsg({ type: 'err', text: err instanceof Error ? err.message : 'Błąd zapisu.' })
    } finally { setSaving(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Wczytywanie profilu kawiarni…</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Nagłówek ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.25rem' }}>
            Zarządzanie
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
            Profil kawiarni
          </h2>
        </div>
        {profile && !profile.profile_complete && (
          <span className="pf-badge pf-badge--warn">
            ⚠ Profil niekompletny — uzupełnij wymagane pola
          </span>
        )}
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '70ch' }}>
        Te dane będą w przyszłości widoczne na publicznej stronie-wizytówce Twojej kawiarni.
        Dla każdego pola możesz zdecydować, czy ma być publiczne — z wyjątkiem pól oznaczonych
        jako zawsze publiczne lub zawsze prywatne.
      </p>

      {saveMsg && (
        <div className={saveMsg.type === 'ok' ? 'form-success' : 'form-error'}>
          {saveMsg.text}
        </div>
      )}

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>

        {/* ── Właściciel (zawsze prywatne) ──────────────────────────────── */}
        <SectionCard
          eyebrow="Z rejestracji"
          title="Dane właściciela"
          badge={<VisibilityBadge visible={false} alwaysPublic={false} />}
        >
          <div className="field">
            <label className="field__label">Imię i nazwisko</label>
            <input className="field__input" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">E-mail (login)</label>
            <input className="field__input" value={profile?.email ?? ''} disabled style={{ opacity: 0.6 }} />
          </div>
          <div className="field">
            <label className="field__label">Telefon</label>
            <input className="field__input" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Te dane nigdy nie są publiczne.
          </p>
        </SectionCard>

        {/* ── Nazwa kawiarni (zawsze publiczna) ─────────────────────────── */}
        <SectionCard
          eyebrow="Z rejestracji"
          title="Nazwa kawiarni"
          badge={<VisibilityBadge visible alwaysPublic />}
        >
          <div className="field">
            <label className="field__label">Nazwa</label>
            <input className="field__input" value={cafeName} onChange={e => setCafeName(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Identyfikator</label>
            <input className="field__input info-row__value--mono" value={profile?.cafe_id ?? ''} disabled style={{ opacity: 0.6 }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Identyfikator nie jest edytowalny ani publiczny.
          </p>
        </SectionCard>

        {/* ── Adres (zawsze publiczny) ───────────────────────────────────── */}
        <SectionCard
          eyebrow="Z rejestracji"
          title="Adres"
          badge={<VisibilityBadge visible alwaysPublic />}
        >
          <div className="field-row">
            <div className="field field--grow">
              <label className="field__label">Ulica</label>
              <input className="field__input" value={street} onChange={e => setStreet(e.target.value)} />
            </div>
            <div className="field field--small">
              <label className="field__label">Nr</label>
              <input className="field__input" value={buildingNumber} onChange={e => setBuildingNumber(e.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="field field--small">
              <label className="field__label">Kod pocztowy</label>
              <input className="field__input" value={postalCode} onChange={e => setPostalCode(e.target.value)} />
            </div>
            <div className="field field--grow">
              <label className="field__label">Miasto</label>
              <input className="field__input" value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="field__label">Kraj</label>
            <input className="field__input" value={country} onChange={e => setCountry(e.target.value)} />
          </div>
        </SectionCard>

        {/* ── Kontakt kawiarni ───────────────────────────────────────────── */}
        <SectionCard eyebrow="Nowe dane" title="Kontakt kawiarni">
          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="field__label">E-mail kawiarni (opcjonalnie)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <VisibilityBadge visible={contactEmailVisible} />
                <Toggle checked={contactEmailVisible} onChange={setContactEmailVisible} disabled={!contactEmail.trim()} />
              </div>
            </div>
            <input className="field__input" value={contactEmail}
              onChange={e => setContactEmail(e.target.value)} placeholder="kontakt@kawiarnia.pl" />
          </div>
          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="field__label">Telefon kawiarni (opcjonalnie)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <VisibilityBadge visible={contactPhoneVisible} />
                <Toggle checked={contactPhoneVisible} onChange={setContactPhoneVisible} disabled={!contactPhone.trim()} />
              </div>
            </div>
            <input className="field__input" value={contactPhone}
              onChange={e => setContactPhone(e.target.value)} placeholder="+48 123 456 789" />
          </div>
        </SectionCard>

        {/* ── Opis ────────────────────────────────────────────────────────── */}
        <SectionCard eyebrow="Nowe dane" title="Krótki opis kawiarni">
          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="field__label">Opis</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <VisibilityBadge visible={descriptionVisible} />
                <Toggle checked={descriptionVisible} onChange={setDescriptionVisible} disabled={!description.trim()} />
              </div>
            </div>
            <textarea
              className="field__input"
              style={{ resize: 'vertical', minHeight: 90, lineHeight: 1.5 }}
              value={description}
              maxLength={2000}
              onChange={e => setDescription(e.target.value)}
              placeholder="Kameralna kawiarnia w sercu miasta, specjalizująca się w kawie z lokalnej palarni…"
            />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'right' }}>{description.length}/2000</span>
          </div>
        </SectionCard>

        {/* ── Logo ────────────────────────────────────────────────────────── */}
        <SectionCard
          eyebrow="Nowe dane · wymagane *"
          title="Logo"
          badge={<VisibilityBadge visible alwaysPublic />}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
              border: '2px solid var(--border)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--cream)',
            }}>
              {logoUrl ? (
                <img
                  src={`http://localhost:8000${logoUrl}`}
                  alt="Logo kawiarni"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: '1.5rem', opacity: 0.3 }}>☕</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button" className="btn btn--outline-dark"
                  style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                >
                  {logoUploading ? 'Wgrywanie…' : logoUrl ? 'Zmień logo' : 'Wgraj logo'}
                </button>
                {logoUrl && (
                  <button
                    type="button" className="me-remove-btn me-remove-item"
                    onClick={handleLogoDelete} title="Usuń logo"
                  >✕</button>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Kwadrat (1:1), min. 512×512 px, max 10 MB.
              </span>
              {!logoUrl && (
                <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>
                  * Pole wymagane do pełnej publikacji wizytówki
                </span>
              )}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={handleLogoSelect}
          />
          {logoError && <div className="form-error" style={{ marginTop: '0.75rem' }}>{logoError}</div>}
        </SectionCard>

      </div>

      {/* ── Godziny otwarcia (pełna szerokość) ──────────────────────────── */}
      <div className="info-card" style={{ gridColumn: '1 / -1' }}>
        <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              Nowe dane · wymagane *
            </div>
            <h2 className="info-card__title" style={{ textTransform: 'none', fontSize: '0.9375rem', marginTop: '0.125rem' }}>
              Godziny otwarcia
            </h2>
          </div>
          <VisibilityBadge visible alwaysPublic />
        </div>
        <div className="info-card__body">
          <div className="res-settings-block__title">Plan tygodniowy (obowiązuje domyślnie)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.5rem' }}>
            {weeklyHours.map(h => {
              const isOpen = h.open_time !== null
              return (
                <div key={h.day_of_week} style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
                  <div style={{ width: 110, fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-dark)' }}>
                    {DAYS[h.day_of_week]}
                  </div>
                  <Toggle checked={isOpen} onChange={v => toggleDay(h.day_of_week, v)} />
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
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Zamknięte</span>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
            <div className="res-settings-block__title">
              Wyjątki w konkretne dni (do {MAX_EXCEPTION_DAYS_AHEAD} dni / 3 tygodni do przodu)
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.875rem', lineHeight: 1.6 }}>
              Np. inne godziny w święto. Wyjątek nadpisuje plan tygodniowy tylko dla wybranej daty.
            </p>
            <ExceptionEditor
              exceptions={exceptions}
              maxDate={maxExceptionDate}
              minDate={todayStr()}
              loading={exceptionsLoading}
              onSave={saveException}
              onDelete={deleteException}
            />
          </div>
        </div>
      </div>

      {/* ── Lokalizacja na mapie (pełna szerokość) ──────────────────────── */}
      <div className="info-card" style={{ gridColumn: '1 / -1' }}>
        <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              Nowe dane · opcjonalne
            </div>
            <h2 className="info-card__title" style={{ textTransform: 'none', fontSize: '0.9375rem', marginTop: '0.125rem' }}>
              Lokalizacja na mapie
            </h2>
          </div>
          {locationVisible
            ? <span className="pf-badge pf-badge--public">publiczne</span>
            : <span className="pf-badge pf-badge--private">prywatne</span>}
        </div>
        <div className="info-card__body">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem', lineHeight: 1.6 }}>
            To osobna pinezka od adresu — dzięki temu możesz dokładnie wskazać wejście do lokalu,
            nawet jeśli adres pocztowy wskazuje na środek budynku lub podwórko.
          </p>
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onPositionChange={handlePositionChange}
            locationVisible={locationVisible}
            onLocationVisibleChange={setLocationVisible}
            showMap={locationShowMap}
            onShowMapChange={setLocationShowMap}
            showGmapsLink={locationShowGmapsLink}
            onShowGmapsLinkChange={setLocationShowGmapsLink}
          />
        </div>
      </div>

      {/* ── Social media ──────────────────────────────────────────────────── */}
      <div className="info-card">
        <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              Nowe dane · opcjonalne
            </div>
            <h2 className="info-card__title" style={{ textTransform: 'none', fontSize: '0.9375rem', marginTop: '0.125rem' }}>
              Social media
            </h2>
          </div>
        </div>
        <div className="info-card__body">
          {socialLinks.length === 0 && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nie dodano jeszcze żadnych linków.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {socialLinks.map((s, idx) => (
              <div key={s.id ?? idx} className="res-table-row">
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="field" style={{ width: 150 }}>
                    <label className="me-label">Platforma</label>
                    <select className="me-input" style={{ cursor: 'pointer' }}
                      value={s.platform} onChange={e => updateSocialLink(idx, { platform: e.target.value })}>
                      {PLATFORM_OPTIONS.map(p => (
                        <option key={p.value} value={p.value}>{p.icon} {p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field" style={{ flex: '2 1 200px' }}>
                    <label className="me-label">Link</label>
                    <input className="me-input" value={s.url}
                      onChange={e => updateSocialLink(idx, { url: e.target.value })}
                      placeholder="https://instagram.com/twojakawiarnia" />
                  </div>
                  {s.platform === 'other' && (
                    <div className="field" style={{ flex: '1 1 140px' }}>
                      <label className="me-label">Etykieta</label>
                      <input className="me-input" value={s.label ?? ''}
                        onChange={e => updateSocialLink(idx, { label: e.target.value })}
                        placeholder="np. Pinterest" />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem' }}>
                    <VisibilityBadge visible={s.visible} />
                    <Toggle checked={s.visible} onChange={v => updateSocialLink(idx, { visible: v })} />
                    <button type="button" className="me-remove-btn me-remove-item"
                      onClick={() => removeSocialLink(idx)} title="Usuń">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="me-add-item-btn" style={{ marginTop: '0.875rem' }} onClick={addSocialLink}>
            + Dodaj link
          </button>
        </div>
      </div>

      {/* ── Pracownicy ───────────────────────────────────────────────────── */}
      <div className="info-card">
        <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold)' }}>
              Nowe dane · opcjonalne
            </div>
            <h2 className="info-card__title" style={{ textTransform: 'none', fontSize: '0.9375rem', marginTop: '0.125rem' }}>
              Zespół
            </h2>
          </div>
        </div>
        <div className="info-card__body">
          {employees.length === 0 && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Nie dodano jeszcze żadnych pracowników.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {employees.map((e, idx) => (
              <div key={e.id ?? idx} className="res-table-row">
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
                  <div className="field" style={{ flex: '1 1 180px' }}>
                    <label className="me-label">Imię i nazwisko</label>
                    <input className="me-input" value={e.full_name}
                      onChange={ev => updateEmployee(idx, { full_name: ev.target.value })}
                      placeholder="Jan Kowalski" />
                  </div>
                  <div className="field" style={{ flex: '1 1 140px' }}>
                    <label className="me-label">Rola</label>
                    <input className="me-input" value={e.role}
                      onChange={ev => updateEmployee(idx, { role: ev.target.value })}
                      placeholder="np. Barista" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem' }}>
                    <VisibilityBadge visible={e.visible} />
                    <Toggle checked={e.visible} onChange={v => updateEmployee(idx, { visible: v })} />
                    <button type="button" className="me-remove-btn me-remove-item"
                      onClick={() => removeEmployee(idx)} title="Usuń">✕</button>
                  </div>
                </div>
                <div className="field">
                  <label className="me-label">Krótkie bio (opcjonalnie)</label>
                  <input className="me-input" value={e.bio ?? ''}
                    onChange={ev => updateEmployee(idx, { bio: ev.target.value })}
                    placeholder="np. Mistrz Polski Baristów 2023" />
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="me-add-item-btn" style={{ marginTop: '0.875rem' }} onClick={addEmployee}>
            + Dodaj pracownika
          </button>
        </div>
      </div>

      {/* ── Zapisz ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.875rem', paddingBottom: '1rem' }}>
        <button
          type="button" className="btn btn--primary"
          style={{ width: 'auto', minWidth: 200 }}
          onClick={handleSave} disabled={saving}
        >
          {saving ? 'Zapisywanie…' : 'Zapisz profil kawiarni'}
        </button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// EXCEPTION EDITOR
// ═════════════════════════════════════════════════════════════════════════════

function ExceptionEditor({ exceptions, maxDate, minDate, loading, onSave, onDelete }: {
  exceptions: HourException[]
  maxDate: string; minDate: string
  loading: boolean
  onSave: (exc: HourException) => void
  onDelete: (date: string) => void
}) {
  const [date, setDate]           = useState(minDate)
  const [isClosed, setIsClosed]   = useState(false)
  const [openTime, setOpenTime]   = useState('09:00')
  const [closeTime, setCloseTime] = useState('21:00')

  const handleAdd = () => {
    onSave({
      date,
      is_closed: isClosed,
      open_time: isClosed ? null : openTime,
      close_time: isClosed ? null : closeTime,
    })
  }

  const formatDate = (ds: string) => {
    const d = new Date(ds + 'T00:00:00')
    return d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Lista istniejących wyjątków */}
      {exceptions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {exceptions
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(exc => (
              <div key={exc.date} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--cream)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '0.625rem 0.875rem', flexWrap: 'wrap', gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)', textTransform: 'capitalize' }}>
                    {formatDate(exc.date)}
                  </span>
                  {exc.is_closed ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--error)' }}>Zamknięte</span>
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {exc.open_time}–{exc.close_time}
                    </span>
                  )}
                </div>
                <button type="button" className="me-remove-btn me-remove-item"
                  onClick={() => onDelete(exc.date)} title="Usuń wyjątek" disabled={loading}>✕</button>
              </div>
          ))}
        </div>
      )}

      {/* Dodawanie nowego */}
      <div className="res-table-row">
        <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ width: 170 }}>
            <label className="me-label">Data</label>
            <input type="date" className="me-input" value={date} min={minDate} max={maxDate}
              onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem' }}>
            <Toggle checked={!isClosed} onChange={v => setIsClosed(!v)} />
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-dark)' }}>
              {isClosed ? 'Zamknięte' : 'Otwarte'}
            </span>
          </div>
          {!isClosed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <input type="time" className="me-input res-time-input" value={openTime}
                onChange={e => setOpenTime(e.target.value)} />
              <span style={{ color: 'var(--text-muted)' }}>–</span>
              <input type="time" className="me-input res-time-input" value={closeTime}
                onChange={e => setCloseTime(e.target.value)} />
            </div>
          )}
          <button type="button" className="btn btn--primary" style={{ width: 'auto', padding: '0.5rem 1.125rem', fontSize: '0.8125rem' }}
            onClick={handleAdd} disabled={loading}>
            + Ustaw wyjątek
          </button>
        </div>
      </div>
    </div>
  )
}