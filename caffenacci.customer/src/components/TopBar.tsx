interface Props {
  authed: boolean
  displayName?: string
  onLogin: () => void
  onRegister: () => void
  onAccount: () => void
  onLogoClick: () => void
}

export default function TopBar({ authed, displayName, onLogin, onRegister, onAccount, onLogoClick }: Props) {
  return (
    <header className="top-bar">
      <button type="button" className="top-bar__brand" onClick={onLogoClick}>
        Caffenacci
      </button>

      <div className="top-bar__actions">
        {authed ? (
          <button type="button" className="top-bar__user" onClick={onAccount}>
            <span className="top-bar__avatar">
              {(displayName || '?').charAt(0).toUpperCase()}
            </span>
            <span className="top-bar__name">{displayName}</span>
          </button>
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