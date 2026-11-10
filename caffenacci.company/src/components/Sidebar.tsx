import { useState } from 'react'
import {
  Home, BarChart3, ClipboardList, ShoppingCart, CalendarDays, Gift, Star,
  Newspaper, Settings, Globe, CreditCard, Menu as MenuIcon, X, LogOut,
} from 'lucide-react'
import logoTransparent from '../assets/logo/logo_transparent.png'
import LanguageSwitcher from './LanguageSwitcher'
import { useI18n } from '../i18n'

export type TabId =
  | 'overview' | 'analytics' | 'menu' | 'orders' | 'reservations'
  | 'loyalty'  | 'reviews' | 'news' | 'profile' | 'website' | 'billing'

type TabIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>

const TABS: { id: TabId; icon: TabIcon }[] = [
  { id: 'overview',     icon: Home },
  { id: 'analytics',    icon: BarChart3 },
  { id: 'menu',         icon: ClipboardList },
  { id: 'orders',       icon: ShoppingCart },
  { id: 'reservations', icon: CalendarDays },
  { id: 'loyalty',      icon: Gift },
  { id: 'reviews',      icon: Star },
  { id: 'news',         icon: Newspaper },
  { id: 'profile',      icon: Settings },
  { id: 'website',      icon: Globe },
  { id: 'billing',      icon: CreditCard },
]

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('') || '?'
}

interface Props {
  activeTab: TabId
  onSelectTab: (t: TabId) => void
  cafeName: string
  ownerName: string
  onLogout: () => void
}

function NavList({ activeTab, onSelectTab }: { activeTab: TabId; onSelectTab: (t: TabId) => void }) {
  const { t } = useI18n()
  return (
    <nav className="sidebar__nav">
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={`sidebar__link${activeTab === tab.id ? ' sidebar__link--active' : ''}`}
          onClick={() => onSelectTab(tab.id)}
        >
          <span className="sidebar__link-icon">
            <tab.icon size={18} strokeWidth={1.8} />
          </span>
          <span>{t(`sidebar.tab.${tab.id}`)}</span>
        </button>
      ))}
    </nav>
  )
}

export default function Sidebar({ activeTab, onSelectTab, cafeName, ownerName, onLogout }: Props) {
  const { t } = useI18n()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSelect = (tab: TabId) => {
    onSelectTab(tab)
    setMobileOpen(false)
  }

  return (
    <>
      <header className="mobile-topbar">
        <div className="mobile-topbar__brand">
          <img src={logoTransparent} alt="Caffenacci" className="mobile-topbar__logo" />
          <span className="mobile-topbar__wordmark" translate="no">Caffenacci</span>
        </div>
        <button
          type="button"
          className="mobile-topbar__menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label={t('sidebar.openMenu')}
        >
          <MenuIcon size={20} />
        </button>
      </header>

      {mobileOpen && (
        <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`sidebar${mobileOpen ? ' sidebar--mobile-open' : ''}`}>
        <div className="sidebar__brand">
          <img src={logoTransparent} alt="Caffenacci" className="sidebar__logo" />
          <div style={{ minWidth: 0 }}>
            <div className="sidebar__wordmark" translate="no">Caffenacci</div>
            <div className="sidebar__cafename" translate="no">{cafeName}</div>
          </div>
          {mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label={t('sidebar.closeMenu')}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'rgba(240,228,204,0.6)', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <NavList activeTab={activeTab} onSelectTab={handleSelect} />

        <div className="sidebar__lang">
          <LanguageSwitcher variant="dark" />
        </div>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">{initials(ownerName)}</div>
            <span className="sidebar__username" translate="no">{ownerName}</span>
          </div>
          <button
            type="button"
            className="sidebar__logout"
            onClick={onLogout}
            title={t('sidebar.logout')}
            aria-label={t('sidebar.logout')}
          >
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>
      </aside>
    </>
  )
}