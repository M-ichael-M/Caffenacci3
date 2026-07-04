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
  authed,
  displayName,
  activeView,
  onLogin,
  onRegister,
  onAccount,
  onSearch,
  onLogout,
}: Props) {
  return (
    <header className="top-bar">
      <div className="top-bar__left">
        <button type="button" className="top-bar__brand" onClick={onSearch}>
          Caffenacci
        </button>

        <nav className="top-bar__nav">
          <button
            type="button"
            className={`top-bar__nav-link${activeView === 'home' ? ' top-bar__nav-link--active' : ''}`}
            onClick={onSearch}
          >
            🔍 Szukaj kawiarni
          </button>
        </nav>
      </div>

      <div className="top-bar__actions">
        {authed ? (
          <>
            <button type="button" className="top-bar__user" onClick={onAccount}>
              <span className="top-bar__avatar">
                {(displayName || '?').charAt(0).toUpperCase()}
              </span>
              <span className="top-bar__name">{displayName}</span>
            </button>
            <button type="button" className="btn btn--outline btn--sm" onClick={onLogout}>
              Wyloguj
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--outline-dark btn--sm" onClick={onLogin}>
              Zaloguj się
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm top-bar__register"
              onClick={onRegister}
            >
              Zarejestruj się
            </button>
          </>
        )}
      </div>
    </header>
  )
}