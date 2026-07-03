interface ClientAuthState {
  token: string
  user_id: string
  nick: string
  full_name: string
}

interface Props {
  auth: ClientAuthState
  onLogout: () => void
}

export default function AccountHome({ auth, onLogout }: Props) {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <span className="dashboard-header__wordmark">Caffenacci</span>
        <div className="dashboard-header__actions">
          <span className="dashboard-header__greeting">Witaj, {auth.full_name}</span>
          <button className="btn btn--outline btn--sm" onClick={onLogout}>
            Wyloguj
          </button>
        </div>
      </header>

      <main className="dashboard-main">
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
                <span className="info-card__icon">☕</span>
                <h2 className="info-card__title">Co dalej</h2>
              </div>
              <div className="info-card__body">
                <p className="info-card__coming-soon">
                  Wkrótce znajdziesz tutaj swoje rezerwacje, zamówienia i opinie —
                  wszystko powiązane z Twoim kontem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}