import { useState } from 'react'
import { Home, CalendarDays, ShoppingCart, Gift, Star, User, Zap, Coffee } from 'lucide-react'
import type { ClientAuthState } from '../authStorage'
import MyReviewsTab from './account/MyReviewsTab'
import MyOrdersTab from './account/MyOrdersTab'
import MyReservationsTab from './account/MyReservationsTab'
import MyLoyaltyTab from './account/MyLoyaltyTab'
import LoyaltyCodeButton from './LoyaltyCodeButton'

interface Props {
  auth: ClientAuthState
}

type TabId = 'overview' | 'reservations' | 'orders' | 'reviews' | 'loyalty'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'overview',     label: 'Przegląd',       icon: Home },
  { id: 'reservations', label: 'Rezerwacje',     icon: CalendarDays },
  { id: 'orders',       label: 'Zamówienia',     icon: ShoppingCart },
  { id: 'loyalty',      label: 'Moje kawiarnie', icon: Gift },
  { id: 'reviews',      label: 'Opinie',         icon: Star },
]

export default function AccountDashboard({ auth }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  return (
    <div className="dashboard">

      <nav className="dashboard-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`dashboard-tab${activeTab === tab.id ? ' dashboard-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="dashboard-tab__icon"><tab.icon size={16} /></span>
            <span className="dashboard-tab__label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="dashboard-main">
        {activeTab === 'overview' && (
          <div className="dashboard-content">
            <div className="page-header">
              <div className="page-header__eyebrow">Twoje konto</div>
              <h1 className="page-header__title">Cześć, {auth.nick}</h1>
            </div>

            <div className="dashboard-grid">
              <div className="info-card">
                <div className="info-card__header">
                  <span className="info-card__icon"><User size={18} /></span>
                  <h2 className="info-card__title">Konto</h2>
                </div>
                <div className="info-card__body">
                  <div className="info-row">
                    <span className="info-row__label">Imię i nazwisko</span>
                    <span className="info-row__value">{auth.full_name}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-row__label">Nick</span>
                    <span className="info-row__value">{auth.nick}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-row__label">Identyfikator</span>
                    <span className="info-row__value info-row__value--mono">{auth.user_id}</span>
                  </div>
                </div>
              </div>

              {/* Program lojalnościowy — kod QR + szybki dostęp do "Moich kawiarni" */}
              <div className="info-card">
                <div className="info-card__header">
                  <span className="info-card__icon"><Gift size={18} /></span>
                  <h2 className="info-card__title">Program lojalnościowy</h2>
                </div>
                <div className="info-card__body" style={{ gap: '0.625rem' }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem' }}>
                    Ten sam kod działa we wszystkich kawiarniach Caffenacci — każda prowadzi własny, niezależny program.
                  </p>
                  <LoyaltyCodeButton token={auth.token} />
                  <button
                    className="btn btn--outline-dark"
                    style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => setActiveTab('loyalty')}
                  >
                    <Coffee size={17} />
                    Zobacz moje kawiarnie
                  </button>
                </div>
              </div>

              <div className="info-card">
                <div className="info-card__header">
                  <span className="info-card__icon"><Zap size={18} /></span>
                  <h2 className="info-card__title">Szybki dostęp</h2>
                </div>
                <div className="info-card__body" style={{ gap: '0.625rem' }}>
                  <button
                    className="btn btn--primary"
                    style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => setActiveTab('reservations')}
                  >
                    <CalendarDays size={17} />
                    Twoje rezerwacje
                  </button>
                  <button
                    className="btn btn--outline-dark"
                    style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => setActiveTab('orders')}
                  >
                    <ShoppingCart size={17} />
                    Twoje zamówienia
                  </button>
                  <button
                    className="btn btn--outline-dark"
                    style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    onClick={() => setActiveTab('reviews')}
                  >
                    <Star size={17} />
                    Twoje opinie
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reservations' && (
          <div className="dashboard-content">
            <MyReservationsTab token={auth.token} />
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="dashboard-content">
            <MyOrdersTab token={auth.token} />
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div className="dashboard-content">
            <MyLoyaltyTab token={auth.token} />
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="dashboard-content">
            <MyReviewsTab token={auth.token} />
          </div>
        )}
      </main>
    </div>
  )
}
