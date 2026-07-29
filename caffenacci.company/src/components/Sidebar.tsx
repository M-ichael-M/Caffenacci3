import { useState } from 'react'
import {
  Home,
  ClipboardList,
  ShoppingCart,
  CalendarDays,
  Gift,
  Star,
  Newspaper,
  Settings,
  Globe,
  CreditCard,
  Menu as MenuIcon,
  X,
  LogOut,
} from 'lucide-react'
import logoTransparent from '../assets/logo/logo_transparent.png'

export type TabId =
  | 'overview' | 'menu' | 'orders' | 'reservations'
  | 'loyalty'  | 'reviews' | 'news' | 'profile' | 'website' | 'billing'

type TabIcon = React.ComponentType<{ size?: number; strokeWidth?: number }>

const TABS: { id: TabId; label: string; icon: TabIcon }[] = [
  { id: 'overview',     label: 'Przegląd',      icon: Home },
  { id: 'menu',         label: 'Menu',          icon: ClipboardList },
  { id: 'orders',       label: 'Zamówienia',    icon: ShoppingCart },
  { id: 'reservations', label: 'Rezerwacje',    icon: CalendarDays },
  { id: 'loyalty',      label: 'Lojalność',     icon: Gift },
  { id: 'reviews',      label: 'Opinie',        icon: Star },
  { id: 'news',         label: 'Aktualności',   icon: Newspaper },
  { id: 'profile',      label: 'Profil',        icon: Settings },
  { id: 'website',      label: 'Strona WWW',    icon: Globe },
  { id: 'billing',      label: 'Płatności',     icon: CreditCard },
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
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default function Sidebar({ activeTab, onSelectTab, cafeName, ownerName, onLogout }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSelect = (t: TabId) => {
    onSelectTab(t)
    setMobileOpen(false)
  }

  return (
    <>
      <header className="mobile-topbar">
        <div className="mobile-topbar__brand">
          <img src={logoTransparent} alt="Caffenacci" className="mobile-topbar__logo" />
          <span className="mobile-topbar__wordmark">Caffenacci</span>
        </div>
        <button
          type="button"
          className="mobile-topbar__menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Otwórz menu"
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
            <div className="sidebar__wordmark">Caffenacci</div>
            <div className="sidebar__cafename">{cafeName}</div>
          </div>
          {mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Zamknij menu"
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

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <div className="sidebar__avatar">{initials(ownerName)}</div>
            <span className="sidebar__username">{ownerName}</span>
          </div>
          <button
            type="button"
            className="sidebar__logout"
            onClick={onLogout}
            title="Wyloguj"
            aria-label="Wyloguj"
          >
            <LogOut size={16} strokeWidth={2} />
          </button>
        </div>
      </aside>
    </>
  )
}