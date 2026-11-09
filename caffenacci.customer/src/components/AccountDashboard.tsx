import { useState, lazy, Suspense } from 'react'
import { Home, CalendarDays, ShoppingCart, Gift, Star, User, Zap, Coffee } from 'lucide-react'
import type { ClientAuthState } from '../authStorage'
import LoyaltyCodeButton from './LoyaltyCodeButton'
import { useI18n } from '../i18n/I18nProvider'

const MyReviewsTab      = lazy(() => import('./account/MyReviewsTab'))
const MyOrdersTab       = lazy(() => import('./account/MyOrdersTab'))
const MyReservationsTab = lazy(() => import('./account/MyReservationsTab'))
const MyLoyaltyTab      = lazy(() => import('./account/MyLoyaltyTab'))

interface Props { auth: ClientAuthState }

type TabId = 'overview' | 'reservations' | 'orders' | 'reviews' | 'loyalty'

const TABS: { id: TabId; labelKey: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'overview',     labelKey: 'acc.tab_overview',     icon: Home },
  { id: 'reservations', labelKey: 'acc.tab_reservations', icon: CalendarDays },
  { id: 'orders',       labelKey: 'acc.tab_orders',       icon: ShoppingCart },
  { id: 'loyalty',      labelKey: 'acc.tab_loyalty',      icon: Gift },
  { id: 'reviews',      labelKey: 'acc.tab_reviews',      icon: Star },
]

const wideBtn = { width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' } as const

export default function AccountDashboard({ auth }: Props) {
  const { t } = useI18n()
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
            <span className="dashboard-tab__label">{t(tab.labelKey)}</span>
          </button>
        ))}
      </nav>

      <main className="dashboard-main">
        <Suspense fallback={<div className="loading-state"><div className="loading-spinner" /></div>}>
          {activeTab === 'overview' && (
            <div className="dashboard-content">
              <div className="page-header">
                <div className="page-header__eyebrow">{t('acc.eyebrow')}</div>
                <h1 className="page-header__title">{t('acc.hello', { nick: auth.nick })}</h1>
              </div>

              <div className="dashboard-grid">
                <div className="info-card">
                  <div className="info-card__header">
                    <span className="info-card__icon"><User size={18} /></span>
                    <h2 className="info-card__title">{t('acc.account')}</h2>
                  </div>
                  <div className="info-card__body">
                    <div className="info-row">
                      <span className="info-row__label">{t('acc.full_name')}</span>
                      <span className="info-row__value">{auth.full_name}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-row__label">{t('acc.nick')}</span>
                      <span className="info-row__value">{auth.nick}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-row__label">{t('acc.id')}</span>
                      <span className="info-row__value info-row__value--mono">{auth.user_id}</span>
                    </div>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-card__header">
                    <span className="info-card__icon"><Gift size={18} /></span>
                    <h2 className="info-card__title">{t('acc.loyalty_title')}</h2>
                  </div>
                  <div className="info-card__body" style={{ gap: '0.625rem' }}>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem' }}>
                      {t('acc.loyalty_note')}
                    </p>
                    <LoyaltyCodeButton token={auth.token} />
                    <button className="btn btn--outline-dark" style={wideBtn} onClick={() => setActiveTab('loyalty')}>
                      <Coffee size={17} />
                      {t('acc.see_cafes')}
                    </button>
                  </div>
                </div>

                <div className="info-card">
                  <div className="info-card__header">
                    <span className="info-card__icon"><Zap size={18} /></span>
                    <h2 className="info-card__title">{t('acc.quick')}</h2>
                  </div>
                  <div className="info-card__body" style={{ gap: '0.625rem' }}>
                    <button className="btn btn--primary" style={wideBtn} onClick={() => setActiveTab('reservations')}>
                      <CalendarDays size={17} />
                      {t('acc.my_reservations')}
                    </button>
                    <button className="btn btn--outline-dark" style={wideBtn} onClick={() => setActiveTab('orders')}>
                      <ShoppingCart size={17} />
                      {t('acc.my_orders')}
                    </button>
                    <button className="btn btn--outline-dark" style={wideBtn} onClick={() => setActiveTab('reviews')}>
                      <Star size={17} />
                      {t('acc.my_reviews')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reservations' && <div className="dashboard-content"><MyReservationsTab token={auth.token} /></div>}
          {activeTab === 'orders'       && <div className="dashboard-content"><MyOrdersTab token={auth.token} /></div>}
          {activeTab === 'loyalty'      && <div className="dashboard-content"><MyLoyaltyTab token={auth.token} /></div>}
          {activeTab === 'reviews'      && <div className="dashboard-content"><MyReviewsTab token={auth.token} /></div>}
        </Suspense>
      </main>
    </div>
  )
}
