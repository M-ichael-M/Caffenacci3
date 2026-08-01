import { useState, useEffect, useCallback, useRef } from 'react'
import type { CSSProperties } from 'react'
import { loadClientAuth, saveClientAuth, clearClientAuth } from '../../authStorage'
import type { ClientAuthState } from '../../authStorage'
import { getPaletteVars } from './palettes'
import MenuOrdering from './MenuOrdering'
import ReservationWidget from './ReservationWidget'
import ReviewsWidget from './ReviewsWidget'
import Gallery from './Gallery'
import LoginForm from '../LoginForm'
import RegisterForm from '../RegisterForm'
import './cafePage.css'
import LoyaltyWidget from './LoyaltyWidget'
import NewsWidget from './NewsWidget'
import { CoffeeIcon, PhoneIcon, MailIcon } from './icons'
import { Eye, X, ExternalLink } from 'lucide-react'
import CafeLocationMap from './CafeLocationMap'

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
interface GalleryImageItem { url: string }
interface NewsPostItem { id: string; title: string; content: string; image_url: string | null; created_at: string }

// Szablon strony — musi odpowiadać ALLOWED_TEMPLATES w backend/app/schemas/site.py
type SiteTemplate =
  | 'classic'
  | 'modern'
  | 'magic'
  | 'usa80s'
  | 'expressive'
  | 'premium'
  | 'industrial'
  | 'glass'
  | 'futuristic'
  | 'tiles'

interface PublicSiteData {
  cafe_id: string
  cafe_name: string
  template: SiteTemplate
  palette: string
  custom_palette: Record<string, string> | null
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
  loyalty_enabled: boolean
  loyalty_mode: string
  loyalty_stamps_max: number
  loyalty_stamps_earn_desc: string | null
  loyalty_stamps_reward_desc: string | null
  loyalty_rewards: { id: string; name: string; cost_points: number }[]
  gallery_images: GalleryImageItem[]
  news_enabled: boolean
  news_posts: NewsPostItem[]
}

interface Props {
  identifier: string        // slug (mode='public') lub cafe_id (mode='preview')
  mode?: 'public' | 'preview'
  previewToken?: string
}
const DAYS = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela']

// Buduje string YYYY-MM-DD z lokalnej daty, bez przechodzenia przez UTC.
// new Date().toISOString() zawsze konwertuje do UTC — w Polsce (UTC+1/+2)
// lokalna północ danego dnia to jeszcze poprzedni dzień w UTC, więc
// .toISOString().slice(0,10) potrafiło cofnąć datę o jeden dzień i psuć
// wyliczanie "dzisiaj", zakresu tygodnia i dopasowania wyjątków godzinowych.
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function computeTodayStatus(data: PublicSiteData) {
  const now = new Date()
  const todayStr = toLocalDateStr(now)
  const pyDow = (now.getDay() + 6) % 7
  const exception = data.hour_exceptions.find(e => e.date === todayStr)
  const dayPlan = data.weekly_hours.find(h => h.day_of_week === pyDow)
  const openTime = exception ? (exception.is_closed ? null : exception.open_time) : (dayPlan?.open_time ?? null)
  const closeTime = exception ? (exception.is_closed ? null : exception.close_time) : (dayPlan?.close_time ?? null)

  if (!openTime || !closeTime) return { open: false, label: 'Dziś zamknięte' }

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = openTime.split(':').map(Number)
  const [ch, cm] = closeTime.split(':').map(Number)
  const isOpen = nowMin >= oh * 60 + om && nowMin < ch * 60 + cm

  return { open: isOpen, label: isOpen ? `Otwarte do ${closeTime}` : `Zamknięte · dziś ${openTime}–${closeTime}` }
}

// ── Pomocnicze funkcje do godzin z wyjątkami ─────────────────────────────
function getCurrentWeekRange(): { start: string; end: string } {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow)
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)

  return { start: toLocalDateStr(monday), end: toLocalDateStr(sunday) }
}

function dateForDayOfWeek(mondayStr: string, dayOfWeek: number): string {
  const [y, m, d] = mondayStr.split('-').map(Number)
  const monday = new Date(y, m - 1, d)
  const target = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + dayOfWeek)
  return toLocalDateStr(target)
}

function formatExceptionDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })
}

function formatExceptionSentence(e: HourException): string {
  const label = formatExceptionDateLabel(e.date)
  if (e.is_closed || !e.open_time || !e.close_time) {
    return `${label} kawiarnia będzie nieczynna.`
  }
  return `${label} kawiarnia będzie pracować w godzinach ${e.open_time}–${e.close_time}.`
}

// ── Pływający przycisk powrotu ─────────────────────────────────────
function HomeFab() {
  return (
    <button
      type="button"
      className="cp-home-fab"
      onClick={() => { window.location.href = '/' }}
      title="Wróć do strony głównej Caffenacci"
    >
      <span className="cp-home-fab__icon" aria-hidden="true"><CoffeeIcon size={16} /></span>
      <span className="cp-home-fab__label">Caffenacci</span>
    </button>
  )
}

export default function CafePage({ identifier, mode = 'public', previewToken }: Props) {
  const isPreview = mode === 'preview'
  const [data, setData] = useState<PublicSiteData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  // W trybie podglądu nigdy nie ma sensu wczytywać zapisanej sesji klienta —
  // podgląd ma pokazywać stronę tak, jak widzi ją niezalogowany gość.
  const [auth, setAuth] = useState<ClientAuthState | null>(() => (isPreview ? null : loadClientAuth()))
  const [authModal, setAuthModal] = useState<null | 'login' | 'register'>(null)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)

  const sparkLayerRef = useRef<HTMLDivElement>(null)

  const fetchSite = useCallback(async () => {
    setLoading(true)
    try {
      const url = mode === 'preview'
        ? `http://localhost:8000/site/preview/${identifier}?token=${encodeURIComponent(previewToken ?? '')}`
        : `http://localhost:8000/site/public/by-slug/${identifier}`
      const res = await fetch(url)
      if (!res.ok) { setNotFound(true); return }
      setData(await res.json())
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [identifier, mode, previewToken])

  useEffect(() => { fetchSite() }, [fetchSite])

  // Iskry – tylko motyw magic
  useEffect(() => {
    if (data?.template !== 'magic') return
    const layer = sparkLayerRef.current
    if (!layer) return

    function spawnSparks(e: MouseEvent) {
      const count = 6 + Math.floor(Math.random() * 5)
      for (let i = 0; i < count; i++) {
        const spark = document.createElement('span')
        spark.className = 'cp-spark'
        const angle = Math.random() * Math.PI * 2
        const dist = 35 + Math.random() * 70
        spark.style.setProperty('--x', `${e.clientX}px`)
        spark.style.setProperty('--y', `${e.clientY}px`)
        spark.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
        spark.style.setProperty('--dy', `${Math.sin(angle) * dist}px`)
        spark.style.animationDelay = `${(Math.random() * 0.08).toFixed(2)}s`
        layer!.appendChild(spark)
        setTimeout(() => spark.remove(), 950)
      }
    }

    window.addEventListener('click', spawnSparks)
    return () => window.removeEventListener('click', spawnSparks)
  }, [data?.template])

  // W trybie podglądu logowanie/rejestracja są całkowicie wyłączone — to ma
  // być wyłącznie podgląd wizualny, bez możliwości wykonania jakiejkolwiek
  // akcji wymagającej kontaktu z serwerem (zamówienia, rezerwacje, opinie).
  function requireLogin(action: () => void) {
    if (isPreview) return
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
        {!isPreview && <HomeFab />}
      </div>
    )
  }

  const paletteVars = (data.palette === 'custom' && data.custom_palette)
    ? (data.custom_palette as CSSProperties)
    : getPaletteVars(data.palette)
  const status = computeTodayStatus(data)
  const todayIsoStr = toLocalDateStr(new Date())

  // ── Godziny otwarcia z wyjątkami ────────────────────────────────
  const { start: weekStart, end: weekEnd } = getCurrentWeekRange()
  const weekHourRows = data.weekly_hours
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map(h => {
      const date = dateForDayOfWeek(weekStart, h.day_of_week)
      const exception = data.hour_exceptions.find(e => e.date === date) ?? null
      const open_time = exception ? (exception.is_closed ? null : exception.open_time) : h.open_time
      const close_time = exception ? (exception.is_closed ? null : exception.close_time) : h.close_time
      const is_closed = exception ? exception.is_closed : !(h.open_time && h.close_time)

      return { day_of_week: h.day_of_week, date, exception, open_time, close_time, is_closed }
    })

  const upcomingExceptions = data.hour_exceptions
    .filter(e => e.date > weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Flagi sekcji ───────────────────────────────────────────────
  const hasContact = !!(data.contact_email || data.contact_phone)
  const hasLocation = data.latitude !== null && data.longitude !== null
  const hasSocial = data.social_links.length > 0
  const hasTeam = data.employees.length > 0
  const hasGallery = data.gallery_images.length > 0
  const menuSections = data.menu_sections.filter(s => s.items.length > 0)
  const hasMenu = menuSections.length > 0

  const gmapsUrl = hasLocation ? `https://www.google.com/maps?q=${data.latitude},${data.longitude}` : null

  return (
    <div className={`cafe-page cafe-page--${data.template}`} style={paletteVars as CSSProperties}>
      {mode === 'preview' && (
        <div className="cp-preview-banner">
          <Eye size={15} />
          Podgląd właściciela — tylko wygląd, bez logowania i akcji na serwerze.
        </div>
      )}
      {/* Sticky nav */}
      <nav className="cp-nav">
        <button className="cp-nav__link" onClick={() => document.getElementById('cp-menu')?.scrollIntoView({ behavior: 'smooth' })}>Menu</button>
        {data.reservations_enabled && (
          <button className="cp-nav__link" onClick={() => document.getElementById('cp-reservations')?.scrollIntoView({ behavior: 'smooth' })}>Rezerwacje</button>
        )}
        {data.loyalty_enabled && (
          <button className="cp-nav__link" onClick={() => document.getElementById('cp-loyalty')?.scrollIntoView({ behavior: 'smooth' })}>Lojalność</button>
        )}
        {hasGallery && (
          <button className="cp-nav__link" onClick={() => document.getElementById('cp-gallery')?.scrollIntoView({ behavior: 'smooth' })}>
            Galeria
          </button>
        )}
        {(hasContact || hasLocation) && (
          <button className="cp-nav__link" onClick={() => document.getElementById('cp-info')?.scrollIntoView({ behavior: 'smooth' })}>Kontakt</button>
        )}
        <button className="cp-nav__link" onClick={() => document.getElementById('cp-reviews')?.scrollIntoView({ behavior: 'smooth' })}>Opinie</button>
        <div style={{ flex: 1 }} />
        <div className="cp-account">
          {isPreview ? (
            // Podgląd jest wyłącznie wizualny — brak logowania/rejestracji/konta.
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              fontSize: '0.8125rem', color: 'var(--text-muted)',
              border: '1px solid var(--border)', borderRadius: 100, padding: '0.3rem 0.75rem',
            }}>
              <Eye size={14} /> Podgląd
            </span>
          ) : auth ? (
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

      {/* Hero */}
      <header className="cp-hero">
        {data.logo_url ? (
          <img className="cp-hero__logo" src={`http://localhost:8000${data.logo_url}`} alt={data.cafe_name} />
        ) : (
          <div className="cp-hero__logo"><CoffeeIcon size={40} /></div>
        )}
        <div>
          <h1 className="cp-hero__name">{data.cafe_name}</h1>
          <p className="cp-hero__address">{data.street} {data.building_number}, {data.postal_code} {data.city}</p>
          <span className={`cp-hero__status cp-hero__status--${status.open ? 'open' : 'closed'}`}>{status.label}</span>
        </div>
      </header>

      <main className="cp-main">
        {/* Opis */}
        {data.description && (
          <section>
            <p style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-body)', maxWidth: '70ch' }}>{data.description}</p>
          </section>
        )}

        {data.news_enabled && data.news_posts.length > 0 && (
          <section id="cp-news">
            <h2 className="cp-section__title">Aktualności</h2>
            <NewsWidget posts={data.news_posts} />
          </section>
        )}

        {/* Menu */}
        <section id="cp-menu">
          <h2 className="cp-section__title">Menu</h2>
          {hasMenu ? (
            <MenuOrdering
              cafeId={data.cafe_id}
              sections={menuSections}
              ordersEnabled={data.orders_enabled}
              requireLogin={requireLogin}
              authToken={auth?.token ?? null}
              weeklyHours={data.weekly_hours}
              hourExceptions={data.hour_exceptions}
              previewMode={isPreview}
            />
          ) : (
            <p className="cp-muted-note">Menu nie zostało jeszcze opublikowane.</p>
          )}
        </section>

        {/* Rezerwacje */}
        {data.reservations_enabled && (
          <section id="cp-reservations">
            <h2 className="cp-section__title">Rezerwacja stolika</h2>
            <ReservationWidget
              cafeId={data.cafe_id}
              enabled={data.reservations_enabled}
              mode={data.reservations_mode}
              requireLogin={requireLogin}
              authToken={auth?.token ?? null}
              previewMode={isPreview}
            />
          </section>
        )}

        {/* Program lojalności */}
        {data.loyalty_enabled && (
          <section id="cp-loyalty">
            <h2 className="cp-section__title">Program lojalności</h2>
            <LoyaltyWidget
              cafeId={data.cafe_id}
              mode={data.loyalty_mode as 'points' | 'stamps'}
              stampsMax={data.loyalty_stamps_max}
              stampsEarnDesc={data.loyalty_stamps_earn_desc}
              stampsRewardDesc={data.loyalty_stamps_reward_desc}
              rewards={data.loyalty_rewards}
              requireLogin={requireLogin}
              authToken={auth?.token ?? null}
              previewMode={isPreview}
            />
          </section>
        )}

        {/* Galeria */}
        {hasGallery && (
          <section id="cp-gallery">
            <h2 className="cp-section__title">Galeria</h2>
            <Gallery images={data.gallery_images} />
          </section>
        )}

        {/* Godziny otwarcia – pełna wersja z wyjątkami */}
        <section>
          <h2 className="cp-section__title">Godziny otwarcia</h2>
          <div style={{ maxWidth: 360 }}>
            {weekHourRows.map(row => (
              <div
                key={row.day_of_week}
                className={`cp-hours-row${row.date === todayIsoStr ? ' cp-hours-row--today' : ''}${row.exception ? ' cp-hours-row--exception' : ''}`}
              >
                <span>
                  {DAYS[row.day_of_week]}
                  {row.exception && <span className="cp-hours-exception-badge">wyjątek</span>}
                </span>
                <span>
                  {!row.is_closed && row.open_time && row.close_time
                    ? `${row.open_time}–${row.close_time}`
                    : 'Zamknięte'}
                </span>
              </div>
            ))}
          </div>

          {upcomingExceptions.length > 0 && (
            <div className="cp-hours-upcoming">
              {upcomingExceptions.map(e => (
                <p key={e.date} className="cp-hours-upcoming__item">
                  {formatExceptionSentence(e)}
                </p>
              ))}
            </div>
          )}
        </section>

        {/* Kontakt i lokalizacja */}
        {(hasContact || hasLocation) && (
          <section id="cp-info">
            <h2 className="cp-section__title">Kontakt i lokalizacja</h2>
            <div className="cp-info-grid">
              {hasContact && (
                <div>
                  {data.contact_phone && (
                    <div style={{ marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <PhoneIcon size={15} className="cp-inline-icon" /> {data.contact_phone}
                    </div>
                  )}
                  {data.contact_email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <MailIcon size={15} className="cp-inline-icon" /> {data.contact_email}
                    </div>
                  )}
                </div>
              )}
              {hasLocation && (
                <div>
                  {data.location_show_map && (
                    <div className="cp-location-map">
                      <CafeLocationMap latitude={data.latitude!} longitude={data.longitude!} />
                    </div>
                  )}
                  {data.location_show_gmaps_link && gmapsUrl && (
                    <a href={gmapsUrl} target="_blank" rel="noreferrer" className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
                      Otwórz w Google Maps <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Zespół */}
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

        {/* Social media */}
        {hasSocial && (
          <section>
            <h2 className="cp-section__title">Znajdź nas</h2>
            <div className="cp-social-links">
              {data.social_links.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noreferrer">
                  {s.label || s.platform}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Opinie */}
        <section id="cp-reviews">
          <h2 className="cp-section__title">Opinie gości</h2>
          <ReviewsWidget
            cafeId={data.cafe_id}
            average={data.reviews_average}
            count={data.reviews_count}
            reviews={data.reviews}
            requireLogin={requireLogin}
            authToken={auth?.token ?? null}
            previewMode={isPreview}
          />
        </section>
      </main>

      {/* Modal logowania/rejestracji — nigdy nie renderowany w trybie podglądu */}
      {!isPreview && authModal && (
        <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) { setAuthModal(null); setPendingAction(null) } }}>
          <div className="menu-editor" style={{ maxWidth: 460, height: 'auto', maxHeight: '90vh' }}>
            <div className="me-header">
              <div>
                <div className="me-eyebrow">Konto gościa</div>
                <h2 className="me-title">{authModal === 'login' ? 'Zaloguj się' : 'Załóż konto'}</h2>
              </div>
              <button className="me-close" type="button" onClick={() => { setAuthModal(null); setPendingAction(null) }}><X size={16} /></button>
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

      {data.template === 'magic' && <div ref={sparkLayerRef} className="cp-spark-layer" aria-hidden="true" />}
      {!isPreview && <HomeFab />}
    </div>
  )
}