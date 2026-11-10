import { useState, useEffect } from 'react'
import Sidebar, { type TabId } from './Sidebar'
import MenuEditor from './MenuEditor'
import ReservationTab from './ReservationTab'
import ProfileTab from './ProfileTab'
import ReviewsTab from './ReviewsTab'
import OrdersTab from './OrdersTab'
import WebsiteTab from './WebsiteTab'
import LoyaltyTab from './LoyaltyTab'
import BillingTab from './BillingTab'
import NewsTab from './NewsTab'
import AnalyticsTab from './AnalyticsTab'
import logoCircle from '../assets/logo/logo_circle.png'
import {
  ClipboardList, CalendarDays, Gift, Star, Settings, Globe, Coffee, User,
  MapPin, Zap, Pencil, Mail, Phone, Flag, Leaf, Flame, Ban,
} from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'

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
  const { t, locale } = useI18n()
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

  // Ceny w menu są w PLN (waluta kawiarni); format zależy od języka panelu.
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'PLN' }).format(n)

  useEffect(() => {
    fetchMenu()
    fetchReviewSummary()
  }, [])

  async function fetchMenu() {
    setLoadingMenu(true)
    try {
      const res = await fetch(`${API_URL}/menu`, {
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
      const res = await fetch(`${API_URL}/reviews/summary`, {
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
    if (h < 5)  return t('dashboard.greeting.night')
    if (h < 12) return t('dashboard.greeting.morning')
    if (h < 18) return t('dashboard.greeting.afternoon')
    return t('dashboard.greeting.evening')
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
                    <div className="welcome-banner__eyebrow">{t('dashboard.eyebrow')}</div>
                    <h1 className="welcome-banner__title">
                      {greeting()}, <span translate="no">{ownerName.split(' ')[0]}</span>
                    </h1>
                    <p className="welcome-banner__sub">
                      {t('dashboard.welcomeSub', { cafe: cafeName })}
                    </p>
                  </div>
                  <img src={logoCircle} alt={cafeName} className="welcome-banner__logo" />
                </div>

                {loadingProfile ? (
                  <div className="loading-state">
                    <div className="loading-spinner" />
                    <p>{t('dashboard.loadingProfile')}</p>
                  </div>
                ) : (
                  <div className="dashboard-grid">
                    {/* Kawiarnia */}
                    <div className="info-card">
                      <div className="info-card__header">
                        <span className="info-card__icon"><Coffee size={20} /></span>
                        <h2 className="info-card__title">{t('dashboard.card.cafe')}</h2>
                      </div>
                      <div className="info-card__body">
                        <div className="info-row">
                          <span className="info-row__label">{t('dashboard.label.name')}</span>
                          <span className="info-row__value" translate="no">{cafeName}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-row__label">{t('dashboard.label.identifier')}</span>
                          <span className="info-row__value info-row__value--mono" translate="no">{cafeId}</span>
                        </div>
                      </div>
                    </div>

                    {/* Właściciel */}
                    <div className="info-card">
                      <div className="info-card__header">
                        <span className="info-card__icon"><User size={20} /></span>
                        <h2 className="info-card__title">{t('dashboard.card.owner')}</h2>
                      </div>
                      <div className="info-card__body">
                        <div className="info-row">
                          <span className="info-row__label">{t('dashboard.label.fullName')}</span>
                          <span className="info-row__value" translate="no">{ownerName}</span>
                        </div>
                        {p?.email && (
                          <div className="info-row">
                            <span className="info-row__label">
                              <Mail size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                              {t('dashboard.label.email')}
                            </span>
                            <span className="info-row__value" translate="no">{p.email}</span>
                          </div>
                        )}
                        {p?.phone && (
                          <div className="info-row">
                            <span className="info-row__label">
                              <Phone size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                              {t('dashboard.label.phone')}
                            </span>
                            <span className="info-row__value" translate="no">{p.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Adres */}
                    {p && p.street && (
                      <div className="info-card">
                        <div className="info-card__header">
                          <span className="info-card__icon"><MapPin size={20} /></span>
                          <h2 className="info-card__title">{t('dashboard.card.address')}</h2>
                        </div>
                        <div className="info-card__body">
                          <div className="info-row">
                            <span className="info-row__label">{t('dashboard.label.street')}</span>
                            <span className="info-row__value" translate="no">{p.street} {p.building_number}</span>
                          </div>
                          <div className="info-row">
                            <span className="info-row__label">{t('dashboard.label.locality')}</span>
                            <span className="info-row__value" translate="no">{p.postal_code} {p.city}</span>
                          </div>
                          <div className="info-row">
                            <span className="info-row__label">
                              <Flag size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                              {t('dashboard.label.country')}
                            </span>
                            <span className="info-row__value" translate="no">{p.country}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Opinie */}
                    <div className="info-card">
                      <div className="info-card__header">
                        <span className="info-card__icon"><Star size={20} /></span>
                        <h2 className="info-card__title">{t('dashboard.card.reviews')}</h2>
                      </div>
                      <div className="info-card__body">
                        {loadingReviews ? (
                          <div className="loading-state" style={{ padding: '0.5rem' }}>
                            <div className="loading-spinner" />
                          </div>
                        ) : reviewSummary && reviewSummary.count > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                              {reviewSummary.average_rating.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </div>
                            <div>
                              <Stars rating={reviewSummary.average_rating} />
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                {t('dashboard.reviews.count', { count: reviewSummary.count })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('dashboard.reviews.none')}</p>
                        )}
                        <button
                          className="btn btn--outline-dark"
                          style={{ width: '100%', padding: '0.625rem', marginTop: '0.5rem' }}
                          onClick={() => setActiveTab('reviews')}
                        >
                          {t('dashboard.reviews.seeAll')}
                        </button>
                      </div>
                    </div>

                    {/* Szybkie akcje */}
                    <div className="info-card">
                      <div className="info-card__header">
                        <span className="info-card__icon"><Zap size={20} /></span>
                        <h2 className="info-card__title">{t('dashboard.card.quickActions')}</h2>
                      </div>
                      <div className="info-card__body" style={{ gap: '0.625rem' }}>
                        <button
                          className="btn btn--primary"
                          style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          onClick={() => setActiveTab('menu')}
                        >
                          <ClipboardList size={18} />
                          {hasMenu ? t('dashboard.quick.editMenu') : t('dashboard.quick.createMenu')}
                        </button>
                        <button
                          className="btn btn--outline-dark"
                          style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          onClick={() => setActiveTab('reservations')}
                        >
                          <CalendarDays size={18} />
                          {t('dashboard.quick.reservations')}
                        </button>
                        <button
                          className="btn btn--outline-dark"
                          style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          onClick={() => setActiveTab('loyalty')}
                        >
                          <Gift size={18} />
                          {t('dashboard.quick.loyalty')}
                        </button>
                        <button
                          className="btn btn--outline-dark"
                          style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          onClick={() => setActiveTab('profile')}
                        >
                          <Settings size={18} />
                          {t('dashboard.quick.profile')}
                        </button>
                        <button
                          className="btn btn--outline-dark"
                          style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                          onClick={() => setActiveTab('website')}
                        >
                          <Globe size={18} />
                          {t('dashboard.quick.website')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STATYSTYKI */}
            {activeTab === 'analytics' && (
              <div className="dashboard-content">
                <AnalyticsTab token={auth.token} />
              </div>
            )}

            {/* MENU */}
            {activeTab === 'menu' && (
              <div className="dashboard-content">
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div className="page-header__eyebrow">{t('common.management')}</div>
                    <h1 className="page-header__title">{t('dashboard.menu.title')}</h1>
                  </div>
                  <button
                    className="btn btn--primary"
                    style={{ width: 'auto', padding: '0.75rem 1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    onClick={() => setShowMenuEditor(true)}
                  >
                    {hasMenu ? (
                      <><Pencil size={18} />{t('dashboard.quick.editMenu')}</>
                    ) : (
                      <><Coffee size={18} />{t('dashboard.quick.createMenu')}</>
                    )}
                  </button>
                </div>

                <div className="menu-preview-card">
                  <div className="menu-preview-card__header">
                    <div className="menu-preview-card__title-wrap">
                      <span className="info-card__icon"><ClipboardList size={20} /></span>
                      <h2 className="info-card__title">{t('dashboard.menu.preview')}</h2>
                    </div>
                    <button
                      className="btn btn--primary btn--sm"
                      style={{ width: 'auto' }}
                      onClick={() => setShowMenuEditor(true)}
                    >
                      {hasMenu ? t('dashboard.menu.edit') : t('dashboard.quick.createMenu')}
                    </button>
                  </div>

                  <div className="menu-preview-card__body">
                    {loadingMenu ? (
                      <div className="loading-state" style={{ padding: '1.5rem' }}>
                        <div className="loading-spinner" />
                      </div>
                    ) : !hasMenu ? (
                      <div className="menu-empty-state">
                        <p>{t('dashboard.menu.empty')}</p>
                        <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                          {t('dashboard.menu.emptyHint')}
                        </p>
                      </div>
                    ) : (
                      // Treść menu wpisał właściciel — nie jest tłumaczona przez panel
                      // (tłumaczenia menu dla gości robi osobny system na stronie kawiarni).
                      menuSections.map(sec => (
                        <div key={sec.id} className="menu-section-preview">
                          <div className="menu-section-preview__name" translate="no">{sec.name}</div>
                          {sec.items.map(item => (
                            <div
                              key={item.id}
                              className={`menu-item-preview${item.is_unavailable ? ' menu-item-preview--unavailable' : ''}`}
                            >
                              <div className="menu-item-preview__info">
                                <div className="menu-item-preview__name">
                                  <span translate="no">{item.name}</span>
                                  {item.is_vege && (
                                    <span className="menu-badge menu-badge--vege">
                                      <Leaf size={11} /> {t('menu.badge.vege')}
                                    </span>
                                  )}
                                  {item.is_hot && (
                                    <span className="menu-badge menu-badge--hot">
                                      <Flame size={11} /> {t('menu.badge.hot')}
                                    </span>
                                  )}
                                  {item.is_unavailable && (
                                    <span className="menu-badge menu-badge--unavail">
                                      <Ban size={11} /> {t('menu.badge.unavailable')}
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <div className="menu-item-preview__desc" translate="no">{item.description}</div>
                                )}
                              </div>
                              <div className="menu-item-preview__price">
                                {money(item.price)}
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

            {/* PŁATNOŚCI I PUBLIKACJA */}
            {activeTab === 'billing' && (
              <div className="dashboard-content">
                <BillingTab token={auth.token} cafeId={cafeId} />
              </div>
            )}

          </main>
        </div>
      </div>
    </>
  )
}