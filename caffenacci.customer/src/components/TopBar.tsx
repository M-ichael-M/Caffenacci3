import { Search, LogIn, UserPlus, LogOut } from 'lucide-react'
import logoWhiteOnBlack from '../assets/logo/logo_white_on_black.png'
import { useI18n } from '../i18n/I18nProvider'
import { LanguageToggle } from '../i18n/siteLanguage'

interface Props {
  authed: boolean
  displayName?: string
  activeView: 'home' | 'account'
  onLogin: () => void
  onRegister: () => void
  onAccount: () => void
  onSearch: () => void
  onLogout: () => void
}

export default function TopBar({
  authed, displayName, activeView, onLogin, onRegister, onAccount, onSearch, onLogout,
}: Props) {
  const { t } = useI18n()
  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <button type="button" className="top-bar__brand" onClick={onSearch}>
          <img src={logoWhiteOnBlack} alt="Caffenacci" className="top-bar__logo" />
          <span className="top-bar__wordmark">Caffenacci</span>
        </button>

        <nav className="top-bar__nav">
          <button
            type="button"
            className={`top-bar__nav-link${activeView === 'home' ? ' top-bar__nav-link--active' : ''}`}
            onClick={onSearch}
          >
            <Search size={15} />
            <span>{t('top.search')}</span>
          </button>
        </nav>
      </div>

      <div className="top-bar__actions">
        <LanguageToggle />
        {authed ? (
          <>
            <button type="button" className="top-bar__user" onClick={onAccount}>
              <span className="top-bar__avatar">{(displayName || '?').charAt(0).toUpperCase()}</span>
              <span className="top-bar__name">{displayName}</span>
            </button>
            <button type="button" className="btn btn--outline btn--sm" onClick={onLogout}>
              <LogOut size={15} />
              {t('top.logout')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--outline-dark btn--sm" onClick={onLogin}>
              <LogIn size={15} />
              {t('top.login')}
            </button>
            <button type="button" className="btn btn--primary btn--sm top-bar__register" onClick={onRegister}>
              <UserPlus size={15} />
              {t('top.register')}
            </button>
          </>
        )}
      </div>
    </header>
  )
}
