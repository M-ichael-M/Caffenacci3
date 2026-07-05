import { useState, useEffect, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { loadClientAuth, saveClientAuth, clearClientAuth } from '../../authStorage'
import type { ClientAuthState } from '../../authStorage'
import { getPaletteVars } from './palettes'
import MenuOrdering from './MenuOrdering'
import ReservationWidget from './ReservationWidget'
import ReviewsWidget from './ReviewsWidget'
import LoginForm from '../LoginForm'
import RegisterForm from '../RegisterForm'
import './cafePage.css'

// ── Typy (odpowiadają backendowemu PublicSiteOut) ───────────────────────────

interface WeeklyHours { day_of_week: number; open_time: string | null; close_time: string | null }
interface HourException { date: string; is_closed: boolean; open_time: string | null; close_time: string | null }
interface SocialLink { platform: string; url: string; label: string | null }
interface Employee { full_name: string; role: string; bio: string | null }
interface MenuItem {
  id: string; name: string; description: string | null; price: number
  is_vege: boolean; is_hot: boolean; is_unavailable: boolean
}
interface MenuSection { id: string; name: string; items: MenuItem[] }
interface ReviewItem { id: string; nick: string; rating: number; comment: string | null; created_at: string }

interface PublicSiteData {
  cafe_id: string
  cafe_name: string
  template: 'classic' | 'modern'
  palette: string
  country: string; city: string; street: string; building_number: string; postal_code: string
  contact_email: string | null
  contact_phone: string | null
  description: string | null
  logo_url: string | null
  latitude: number | null
  longitude: number | null
  location_show_map: boolean
  location_show_gmaps_link: boolean
  weekly_hours: WeeklyHours[]
  hour_exceptions: HourException[]
  social_links: SocialLink[]
  employees: Employee[]
  menu_sections: MenuSection[]
  orders_enabled: boolean
  reservations_enabled: boolean
  reservations_mode: string
  reviews_average: number
  reviews_count: number
  reviews: ReviewItem[]
}

interface Props { cafeId: string }

const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']

function computeTodayStatus(data: PublicSiteData) {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const pyDow = (now.getDay() + 6) % 7 // JS: 0=niedziela → backend: 0=poniedziałek
  const exception = data.hour_exceptions.find(e => e.date === todayStr)
  const dayPlan = data.weekly_hours.find(h => h.day_of_week === pyDow)
  const openTime  = exception ? (exception.is_closed ? null : exception.open_time)  : (dayPlan?.open_time  ?? null)
  const closeTime = exception ? (exception.is_closed ? null : exception.close_time) : (dayPlan?.close_time ?? null)
  if (!openTime || !closeTime) return { open: false, label: 'Dziś zamknięte' }
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = openTime.split(':').map(Number)
  const [ch, cm] = closeTime.split(':').map(Number)
  const isOpen = nowMin >= oh * 60 + om && nowMin < ch * 60 + cm
  return { open: isOpen, label: isOpen ? `Otwarte do ${closeTime}` : `Zamknięte · dziś ${openTime}–${closeTime}` }
}

export default function CafePage({ cafeId }: Props) {
  const [data, setData] = useState<PublicSiteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [auth, setAuth] = useState<ClientAuthState | null>(() => loadClientAuth())
  const [authModal, setAuthModal] = useState<null | 'login' | 'register'>(null)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const fetchSite = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`http://localhost:8000/site/public/${cafeId}`)
      if (!res.ok) { setNotFound(true); return }
      setData(await res.json())
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [cafeId])

  useEffect(() => { fetchSite() }, [fetchSite])

  function requireLogin(action: () => void) {
    if (auth) { action(); return }
    setPendingAction(() => action)
    setAuthModal('login')
  }

  function handleLoginSuccess(d: { access_token: string; user_id: string; nick: string; full_name: string }) {
    const state: ClientAuthState = { token: d.access_token, user_id: d.user_id, nick: d.nick, full_name: d.full_name }
    saveClientAuth(state)
    setAuth(state)
    setAuthModal(null)
    if (pendingAction) {
      const action = pendingAction
      setPendingAction(null)
      setTimeout(action, 0)
    }
  }

  function handleLogout() {
    clearClientAuth()
    setAuth(null)
  }

  if (loading) {
    return (
      <div className="loading-state" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
        <p>Wczytywanie strony kawiarni…</p>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="loading-state" style={{ minHeight: '100vh' }}>
        <p>Nie znaleziono takiej kawiarni.</p>
      </div>
    )
  }

  const paletteVars = getPaletteVars(data.palette)
  const status = computeTodayStatus(data)
  const todayDow = (new Date().getDay() + 6) % 7

  const hasContact  = !!(data.contact_email || data.contact_phone)
  const hasLocation = data.latitude !== null && data.longitude !== null
  const hasSocial   = data.social_links.length > 0
  const hasTeam     = data.employees.length > 0
  const menuSections = data.menu_sections.filter(s => s.items.length > 0)
  const hasMenu     = menuSections.length > 0

  const gmapsUrl = hasLocation ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}` : null

  return (
    <div className={`cafe-page cafe-page--${data.template}`} style={paletteVars as CSSProperties}>

      {/* ── Sticky nav ─────────────────────────────────────────────────── */}
      <nav className="cp-nav">
        <button className="cp-nav__link" onClick={() => document.getElementById('cp-menu')?.scrollIntoView({ behavior: 'smooth' })}>Menu</button>
        {data.reservations_enabled && (
          <button className="cp-nav__link" onClick={() => document.getElementById('cp-reservations')?.scrollIntoView({ behavior: 'smooth' })}>Rezerwacje</button>
        )}
        <button className="cp-nav__link" onClick={() => document.getElementById('cp-reviews')?.scrollIntoView({ behavior: 'smooth' })}>Opinie</button>
        {(hasContact || hasLocation) && (
          <button className="cp-nav__link" onClick={() => document.getElementById('cp-info')?.scrollIntoView({ behavior: 'smooth' })}>Kontakt</button>
        )}
        <div style={{ flex: 1 }} />
        <div className="cp-account">
          {auth ? (
            <>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Cześć, {auth.nick}</span>
              <button className="btn btn--outline-dark btn--sm" onClick={handleLogout}>Wyloguj</button>
            </>
          ) : (
            <>
              <button className="btn btn--outline-dark btn--sm" onClick={() => setAuthModal('login')}>Zaloguj się</button>
              <button className="btn btn--primary btn--sm" style={{ width: 'auto', marginTop: 0 }} onClick={() => setAuthModal('register')}>Zarejestruj się</button>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <header className="cp-hero">
        {data.logo_url ? (
          <img className="cp-hero__logo" src={`http://localhost:8000${data.logo_url}`} alt={data.cafe_name} />
        ) : (
          <div className="cp-hero__logo">☕</div>
        )}
        <div>
          <h1 className="cp-hero__name">{data.cafe_name}</h1>
          <p className="cp-hero__address">{data.street} {data.building_number}, {data.postal_code} {data.city}</p>
          <span className={`cp-hero__status cp-hero__status--${status.open ? 'open' : 'closed'}`}>{status.label}</span>
        </div>
      </header>

      <main className="cp-main">

        {/* ── Opis ─────────────────────────────────────────────────────── */}
        {data.description && (
          <section>
            <p style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-body)', maxWidth: '70ch' }}>{data.description}</p>
          </section>
        )}

        {/* ── Menu + zamówienia ────────────────────────────────────────── */}
        <section id="cp-menu">
          <h2 className="cp-section__title">Menu</h2>
          {hasMenu ? (
            <MenuOrdering
              cafeId={data.cafe_id}
              sections={menuSections}
              ordersEnabled={data.orders_enabled}
              requireLogin={requireLogin}
              authToken={auth?.token ?? null}
            />
          ) : (
            <p className="cp-muted-note">Menu nie zostało jeszcze opublikowane.</p>
          )}
        </section>

        {/* ── Rezerwacje ───────────────────────────────────────────────── */}
        {data.reservations_enabled && (
          <section id="cp-reservations">
            <h2 className="cp-section__title">Rezerwacja stolika</h2>
            <ReservationWidget
              cafeId={data.cafe_id}
              enabled={data.reservations_enabled}
              requireLogin={requireLogin}
              authToken={auth?.token ?? null}
            />
          </section>
        )}

        {/* ── Godziny otwarcia ─────────────────────────────────────────── */}
        <section>
          <h2 className="cp-section__title">Godziny otwarcia</h2>
          <div style={{ maxWidth: 360 }}>
            {data.weekly_hours.slice().sort((a, b) => a.day_of_week - b.day_of_week).map(h => (
              <div key={h.day_of_week} className={`cp-hours-row${h.day_of_week === todayDow ? ' cp-hours-row--today' : ''}`}>
                <span>{DAYS[h.day_of_week]}</span>
                <span>{h.open_time && h.close_time ? `${h.open_time}–${h.close_time}` : 'Zamknięte'}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Kontakt / lokalizacja ────────────────────────────────────── */}
        {(hasContact || hasLocation) && (
          <section id="cp-info">
            <h2 className="cp-section__title">Kontakt i lokalizacja</h2>
            <div className="cp-info-grid">
              {hasContact && (
                <div>
                  {data.contact_phone && <div style={{ marginBottom: '0.375rem' }}>📞 {data.contact_phone}</div>}
                  {data.contact_email && <div>✉️ {data.contact_email}</div>}
                </div>
              )}
              {hasLocation && (
                <div>
                  {data.location_show_map && (
                    <iframe
                      title="Mapa"
                      width="100%"
                      height="180"
                      style={{ border: 0, borderRadius: 8 }}
                      loading="lazy"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${data.longitude! - 0.01}%2C${data.latitude! - 0.01}%2C${data.longitude! + 0.01}%2C${data.latitude! + 0.01}&layer=mapnik&marker=${data.latitude}%2C${data.longitude}`}
                    />
                  )}
                  {data.location_show_gmaps_link && gmapsUrl && (
                    <a href={gmapsUrl} target="_blank" rel="noreferrer" className="link" style={{ display: 'inline-block', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                      Otwórz w Google Maps ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Zespół ───────────────────────────────────────────────────── */}
        {hasTeam && (
          <section>
            <h2 className="cp-section__title">Nasz zespół</h2>
            <div className="cp-team-grid">
              {data.employees.map((e, i) => (
                <div key={i} className="cp-team-card">
                  <div className="cp-team-card__name">{e.full_name}</div>
                  <div className="cp-team-card__role">{e.role}</div>
                  {e.bio && <div className="cp-team-card__bio">{e.bio}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Social media ─────────────────────────────────────────────── */}
        {hasSocial && (
          <section>
            <h2 className="cp-section__title">Znajdź nas</h2>
            <div className="cp-social-links">
              {data.social_links.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer">{s.label || s.platform}</a>
              ))}
            </div>
          </section>
        )}

        {/* ── Opinie ───────────────────────────────────────────────────── */}
        <section id="cp-reviews">
          <h2 className="cp-section__title">Opinie gości</h2>
          <ReviewsWidget
            cafeId={data.cafe_id}
            average={data.reviews_average}
            count={data.reviews_count}
            reviews={data.reviews}
            requireLogin={requireLogin}
            authToken={auth?.token ?? null}
          />
        </section>

      </main>

      {/* ── Modal logowania / rejestracji ────────────────────────────────── */}
      {authModal && (
        <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) { setAuthModal(null); setPendingAction(null) } }}>
          <div className="menu-editor" style={{ maxWidth: 460, height: 'auto', maxHeight: '90vh' }}>
            <div className="me-header">
              <div>
                <div className="me-eyebrow">Konto gościa</div>
                <h2 className="me-title">{authModal === 'login' ? 'Zaloguj się' : 'Załóż konto'}</h2>
              </div>
              <button className="me-close" type="button" onClick={() => { setAuthModal(null); setPendingAction(null) }}>✕</button>
            </div>
            <div className="me-body">
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Rezerwacje, zamówienia i opinie są dostępne wyłącznie dla zalogowanych gości.
              </p>
              {authModal === 'login' ? (
                <LoginForm onSuccess={handleLoginSuccess} onSwitchToRegister={() => setAuthModal('register')} />
              ) : (
                <RegisterForm onSuccess={() => setAuthModal('login')} onSwitchToLogin={() => setAuthModal('login')} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
