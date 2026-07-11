import { useState } from 'react'
import type { ClientAuthState } from '../authStorage'
import MyReviewsTab from './account/MyReviewsTab'
import MyOrdersTab from './account/MyOrdersTab'
import MyReservationsTab from './account/MyReservationsTab'

interface Props {
  auth: ClientAuthState
}

type TabId = 'overview' | 'reservations' | 'orders' | 'reviews'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',     label: 'Przegląd',   icon: '🏠' },
  { id: 'reservations', label: 'Rezerwacje', icon: '📅' },
  { id: 'orders',       label: 'Zamówienia', icon: '🛒' },
  { id: 'reviews',      label: 'Opinie',     icon: '⭐' },
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
            <span className="dashboard-tab__icon">{tab.icon}</span>
            <span className="dashboard-tab__label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="dashboard-main">
        {activeTab === 'overview' && (
          <div className="dashboard-content">
            <div className="page-header">
              <div className="page-header__eyebrow">Twoje konto</div>
              <h1 className="page-header__title">Cześć, {auth.nick} 👋</h1>
            </div>

            <div className="dashboard-grid">
              <div className="info-card">
                <div className="info-card__header">
                  <span className="info-card__icon">👤</span>
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

              <div className="info-card">
                <div className="info-card__header">
                  <span className="info-card__icon">📌</span>
                  <h2 className="info-card__title">Szybki dostęp</h2>
                </div>
                <div className="info-card__body" style={{ gap: '0.625rem' }}>
                  <button className="btn btn--primary" style={{ width: '100%', padding: '0.75rem' }} onClick={() => setActiveTab('reservations')}>
                    📅 Twoje rezerwacje
                  </button>
                  <button className="btn btn--outline-dark" style={{ width: '100%', padding: '0.75rem' }} onClick={() => setActiveTab('orders')}>
                    🛒 Twoje zamówienia
                  </button>
                  <button className="btn btn--outline-dark" style={{ width: '100%', padding: '0.75rem' }} onClick={() => setActiveTab('reviews')}>
                    ⭐ Twoje opinie
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

        {activeTab === 'reviews' && (
          <div className="dashboard-content">
            <MyReviewsTab token={auth.token} />
          </div>
        )}
      </main>
    </div>
  )
}