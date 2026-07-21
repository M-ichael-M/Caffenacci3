import { useState, useEffect } from 'react'
import Sidebar, { type TabId } from './Sidebar'
import MenuEditor from './MenuEditor'
import ReservationTab from './ReservationTab'
import ProfileTab from './ProfileTab'
import ReviewsTab from './ReviewsTab'
import OrdersTab from './OrdersTab'
import WebsiteTab from './WebsiteTab'
import LoyaltyTab from './LoyaltyTab'
import NewsTab from './NewsTab'
import logoCircle from '../assets/logo/logo_circle.png'
import {
  ClipboardList,
  CalendarDays,
  Gift,
  Star,
  Settings,
  Globe,
  Coffee,
  User,
  MapPin,
  Zap,
  Pencil,
  Mail,
  Phone,
  Flag,
  Leaf,
  Flame,
  Ban,
} from 'lucide-react'

interface AuthState {
  token: string
  cafe_id: string
  cafe_name: string
  owner_name: string
}

interface ServerItem {
  id: string
  name: string
  description?: string
  price: number
  position: number
  is_vege: boolean
  is_hot: boolean
  is_unavailable: boolean
}

interface ServerSection {
  id: string
  name: string
  position: number
  items: ServerItem[]
}

interface MeProfile {
  id?: string
  owner_name?: string
  cafe_name?: string
  email?: string
  phone?: string
  country?: string
  city?: string
  street?: string
  building_number?: string
  postal_code?: string
}

interface ReviewSummary {
  average_rating: number
  count: number
}

interface Props {
  auth: AuthState
  profile: Record<string, unknown> | null
  loadingProfile: boolean
  onLogout: () => void
}

function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ color: 'var(--gold)', fontSize: '1.125rem', letterSpacing: '1px' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ opacity: i <= Math.round(rating) ? 1 : 0.25 }}>★</span>
      ))}
    </div>
  )
}

export default function Dashboard({ auth, profile, loadingProfile, onLogout }: Props) {
  const p = profile as MeProfile | null
  const cafeName  = p?.cafe_name  ?? auth.cafe_name
  const ownerName = p?.owner_name ?? auth.owner_name
  const cafeId    = p?.id         ?? auth.cafe_id

  const [activeTab, setActiveTab]           = useState<TabId>('overview')
  const [showMenuEditor, setShowMenuEditor] = useState(false)
  const [menuSections, setMenuSections]     = useState<ServerSection[]>([])
  const [loadingMenu, setLoadingMenu]       = useState(true)

  const [reviewSummary, setReviewSummary]   = useState<ReviewSummary | null>(null)
  const [loadingReviews, setLoadingReviews] = useState(true)

  useEffect(() => {
    fetchMenu()
    fetchReviewSummary()
  }, [])

  async function fetchMenu() {
    setLoadingMenu(true)
    try {
      const res = await fetch('http://localhost:8000/menu', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMenuSections(data.sections ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoadingMenu(false) }
  }

  async function fetchReviewSummary() {
    setLoadingReviews(true)
    try {
      const res = await fetch('http://localhost:8000/reviews/summary', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        setReviewSummary(await res.json())
      }
    } catch { /* ignore */ }
    finally { setLoadingReviews(false) }
  }

  function handleMenuEditorClose() {
    setShowMenuEditor(false)
    fetchMenu()
  }

  const hasMenu = menuSections.length > 0

  function greeting(): string {
    const h = new Date().getHours()
    if (h < 5)  return 'Dobrej nocy'
    if (h < 12) return 'Dzień dobry'
    if (h < 18) return 'Miłego popołudnia'
    return 'Dobry wieczór'
  }

  return (
    <>
      {showMenuEditor && (
        <MenuEditor token={auth.token} onClose={handleMenuEditorClose} />
      )}

      <div className="app-shell">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          cafeName={cafeName}
          ownerName={ownerName}
          onLogout={onLogout}
        />

        <div className="app-main">
          <main className="dashboard-main">

            {/* PRZEGLĄD */}
            {activeTab === 'overview' && (
              <div className="dashboard-content">
                <div className="welcome-banner">
                  <div className="welcome-banner__text">
                    <div className="welcome-banner__eyebrow">Panel kawiarni</div>
                    <h1 className="welcome-banner__title">{greeting()}, {ownerName.split(' ')[0]}</h1>
                    <p className="welcome-banner__sub">{cafeName} — oto, co dzieje się dzisiaj.</p>
                  </div>
                  <img src={logoCircle} alt={cafeName} className="welcome-banner__logo" />
                </div>

                {loadingProfile ? (
                  <div className="loading-state">
                    <div className="loading-spinner" />
                    <p>Pobieranie danych kawiarni…</p>
                  </div>
                ) : (
                  <div className="dashboard-grid">
                    {/* Kawiarnia */}
                    <div className="info-card">
                      <div className="info-card__header">
                        <span className="info-card__icon">
                          <Coffee size={20} />
                        </span>
                        <h2 className="info-card__title">Kawiarnia</h2>
                      </div>
                      <div className="info-card__body">
                        <div className="info-row">
                          <span className="info-row__label">Nazwa</span>
                          <span className="info-row__value">{cafeName}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-row__label">Identyfikator</span>
                          <span className="info-row__value info-row__value--mono">{cafeId}</span>
                        </div>
                      </div>
                    </div>

                    {/* Właściciel */}
                    <div className="info-card">
                      <div className="info-card__header">
                        <span className="info-card__icon"><User size={20} /></span>
                        <h2 className="info-card__title">Właściciel</h2>
                      </div>
                      <div className="info-card__body">
                        <div className="info-row">
                          <span className="info-row__label">Imię i nazwisko</span>
                          <span className="info-row__value">{ownerName}</span>
                        </div>
                        {p?.email && (
                          <div className="info-row">
                            <span className="info-row__label">
                              <Mail size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                              E-mail
                            </span>
                            <span className="info-row__value">{p.email}</span>
                          </div>
                        )}
                        {p?.phone && (
                          <div className="info-row">
                            <span className="info-row__label">
                              <Phone size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                              Telefon
                            </span>
                            <span className="info-row__value">{p.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Adres */}
                    {p && p.street && (
                      <div className="info-card">
                        <div className="info-card__header">
                          <span className="info-card__icon"><MapPin size={20} /></span>
                          <h2 className="info-card__title">Adres</h2>
                        </div>
                        <div className="info-card__body">
                          <div className="info-row">
                            <span className="info-row__label">Ulica</span>
                            <span className="info-row__value">{p.street} {p.building_number}</span>
                          </div>
                          <div className="info-row">
                            <span className="info-row__label">Miejscowość</span>
                            <span className="info-row__value">{p.postal_code} {p.city}</span>
                          </div>
                          <div className="info-row">
                            <span className="info-row__label">
                              <Flag size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                              Kraj
                            </span>
                            <span className="info-row__value">{p.country}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Opinie */}
                    <div className="info-card">
                      <div className="info-card__header">
                        <span className="info-card__icon"><Star size={20} /></span>
                        <h2 className="info-card__title">Opinie</h2>
                      </div>
                      <div className="info-card__body">
                        {loadingReviews ? (
                          <div className="loading-state" style={{ padding: '0.5rem' }}>
                            <div className="loading-spinner" />
                          </div>
                        ) : reviewSummary && reviewSummary.count > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                              {reviewSummary.average_rating.toFixed(1)}
                            </div>
                            <div>
                              <Stars rating={reviewSummary.average_rating} />
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                {reviewSummary.count === 1
                                  ? '1 opinia'
                                  : reviewSummary.count < 5
                                    ? `${reviewSummary.count} opinie`
                                    : `${reviewSummary.count} opinii`}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Brak opinii jeszcze.</p>
                        )}
                        <button
                          className="btn btn--outline-dark"
                          style={{ width: '100%', padding: '0.625rem', marginTop: '0.5rem' }}
                          onClick={() => setActiveTab('reviews')}
                        >
                          Zobacz wszystkie opinie
                        </button>
                      </div>
                    </div>

                    {/* Szybkie akcje */}
                    <div className="info-card">
                      <div className="info-card__header">
                        <span className="info-card__icon">
                          <Zap size={20} />
                        </span>
                        <h2 className="info-card__title">Szybkie akcje</h2>
                      </div>
                      <div className="info-card__body" style={{ gap: '0.625rem' }}>
                        <button
                          className="btn btn--primary"
                          style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          onClick={() => setActiveTab('menu')}
                        >
                          <ClipboardList size={18} />
                          {hasMenu ? 'Edytuj menu' : 'Utwórz menu'}
                        </button>
                        <button
                          className="btn btn--outline-dark"
                          style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          onClick={() => setActiveTab('reservations')}
                        >
                          <CalendarDays size={18} />
                          Zarządzaj rezerwacjami
                        </button>
                        <button
                          className="btn btn--outline-dark"
                          style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          onClick={() => setActiveTab('loyalty')}
                        >
                          <Gift size={18} />
                          Program lojalnościowy
                        </button>
                        <button
                          className="btn btn--outline-dark"
                          style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          onClick={() => setActiveTab('profile')}
                        >
                          <Settings size={18} />
                          Uzupełnij profil kawiarni
                        </button>
                        <button
                          className="btn btn--outline-dark"
                          style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          onClick={() => setActiveTab('website')}
                        >
                          <Globe size={18} />
                          Skonfiguruj stronę WWW
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MENU */}
            {activeTab === 'menu' && (
              <div className="dashboard-content">
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div className="page-header__eyebrow">Zarządzanie</div>
                    <h1 className="page-header__title">Menu kawiarni</h1>
                  </div>
                  <button
                    className="btn btn--primary"
                    style={{ width: 'auto', padding: '0.75rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => setShowMenuEditor(true)}
                  >
                    {hasMenu ? (
                      <>
                        <Pencil size={18} />
                        Edytuj menu
                      </>
                    ) : (
                      <>
                        <Coffee size={18} />
                        Utwórz menu
                      </>
                    )}
                  </button>
                </div>

                <div className="menu-preview-card">
                  <div className="menu-preview-card__header">
                    <div className="menu-preview-card__title-wrap">
                      <span className="info-card__icon">
                        <ClipboardList size={20} />
                      </span>
                      <h2 className="info-card__title">Podgląd menu</h2>
                    </div>
                    <button
                      className="btn btn--primary btn--sm"
                      style={{ width: 'auto' }}
                      onClick={() => setShowMenuEditor(true)}
                    >
                      {hasMenu ? 'Edytuj' : 'Utwórz menu'}
                    </button>
                  </div>

                  <div className="menu-preview-card__body">
                    {loadingMenu ? (
                      <div className="loading-state" style={{ padding: '1.5rem' }}>
                        <div className="loading-spinner" />
                      </div>
                    ) : !hasMenu ? (
                      <div className="menu-empty-state">
                        <p>Menu nie zostało jeszcze utworzone.</p>
                        <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                          Kliknij „Utwórz menu” aby dodać sekcje i pozycje.
                        </p>
                      </div>
                    ) : (
                      menuSections.map(sec => (
                        <div key={sec.id} className="menu-section-preview">
                          <div className="menu-section-preview__name">{sec.name}</div>
                          {sec.items.map(item => (
                            <div
                              key={item.id}
                              className={`menu-item-preview${item.is_unavailable ? ' menu-item-preview--unavailable' : ''}`}
                            >
                              <div className="menu-item-preview__info">
                                <div className="menu-item-preview__name">
                                  {item.name}
                                  {item.is_vege && (
                                    <span className="menu-badge menu-badge--vege">
                                      <Leaf size={11} /> VEGE
                                    </span>
                                  )}
                                  {item.is_hot && (
                                    <span className="menu-badge menu-badge--hot">
                                      <Flame size={11} /> HOT
                                    </span>
                                  )}
                                  {item.is_unavailable && (
                                    <span className="menu-badge menu-badge--unavail">
                                      <Ban size={11} /> NIEDOSTĘPNE
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <div className="menu-item-preview__desc">{item.description}</div>
                                )}
                              </div>
                              <div className="menu-item-preview__price">
                                {item.price.toFixed(2)} zł
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* REZERWACJE */}
            {activeTab === 'reservations' && (
              <div className="dashboard-content">
                <ReservationTab token={auth.token} cafeId={cafeId} />
              </div>
            )}

            {/* ZAMÓWIENIA */}
            {activeTab === 'orders' && (
              <div className="dashboard-content">
                <OrdersTab token={auth.token} cafeId={cafeId} />
              </div>
            )}

            {/* LOJALNOŚĆ */}
            {activeTab === 'loyalty' && (
              <div className="dashboard-content">
                <LoyaltyTab token={auth.token} />
              </div>
            )}

            {activeTab === 'news' && (
              <div className="dashboard-content">
                <NewsTab token={auth.token} />
              </div>
            )}

            {/* OPINIE */}
            {activeTab === 'reviews' && (
              <div className="dashboard-content">
                <ReviewsTab token={auth.token} cafeId={cafeId} />
              </div>
            )}

            {/* PROFIL */}
            {activeTab === 'profile' && (
              <div className="dashboard-content">
                <ProfileTab token={auth.token} />
              </div>
            )}

            {/* STRONA WWW */}
            {activeTab === 'website' && (
              <div className="dashboard-content">
                <WebsiteTab token={auth.token} cafeId={cafeId} />
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  )
}