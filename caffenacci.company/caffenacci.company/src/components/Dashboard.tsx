interface AuthState {
  token: string
  cafe_id: string
  cafe_name: string
  owner_name: string
}

interface MeProfile {
  id?: string
  owner_name?: string
  cafe_name?: string
  email?: string
  phone?: string
  address?: {
    country: string
    city: string
    street: string
    building_number: string
    postal_code: string
  }
}

interface Props {
  auth: AuthState
  profile: Record<string, unknown> | null
  loadingProfile: boolean
  onLogout: () => void
}

export default function Dashboard({ auth, profile, loadingProfile, onLogout }: Props) {
  const p = profile as MeProfile | null
  const cafeName  = p?.cafe_name  ?? auth.cafe_name
  const ownerName = p?.owner_name ?? auth.owner_name
  const cafeId    = p?.id         ?? auth.cafe_id

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <span className="dashboard-header__wordmark">Caffenacci</span>
        <div className="dashboard-header__actions">
          <span className="dashboard-header__greeting">Witaj, {ownerName}</span>
          <button className="btn btn--outline btn--sm" onClick={onLogout}>
            Wyloguj
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="page-header">
            <div className="page-header__eyebrow">Panel kawiarni</div>
            <h1 className="page-header__title">{cafeName}</h1>
          </div>

          {loadingProfile ? (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>Pobieranie danych kawiarni…</p>
            </div>
          ) : (
            <div className="dashboard-grid">

              {/* Kawiarnia */}
              <div className="info-card">
                <div className="info-card__header">
                  <span className="info-card__icon">☕</span>
                  <h2 className="info-card__title">Kawiarnia</h2>
                </div>
                <div className="info-card__body">
                  <div className="info-row">
                    <span className="info-row__label">Nazwa</span>
                    <span className="info-row__value">{cafeName}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-row__label">Identyfikator</span>
                    <span className="info-row__value info-row__value--mono">{cafeId}</span>
                  </div>
                </div>
              </div>

              {/* Właściciel */}
              <div className="info-card">
                <div className="info-card__header">
                  <span className="info-card__icon">👤</span>
                  <h2 className="info-card__title">Właściciel</h2>
                </div>
                <div className="info-card__body">
                  <div className="info-row">
                    <span className="info-row__label">Imię i nazwisko</span>
                    <span className="info-row__value">{ownerName}</span>
                  </div>
                  {p?.email && (
                    <div className="info-row">
                      <span className="info-row__label">E-mail</span>
                      <span className="info-row__value">{p.email}</span>
                    </div>
                  )}
                  {p?.phone && (
                    <div className="info-row">
                      <span className="info-row__label">Telefon</span>
                      <span className="info-row__value">{p.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Adres */}
              {p?.address && (
                <div className="info-card">
                  <div className="info-card__header">
                    <span className="info-card__icon">📍</span>
                    <h2 className="info-card__title">Adres</h2>
                  </div>
                  <div className="info-card__body">
                    <div className="info-row">
                      <span className="info-row__label">Ulica</span>
                      <span className="info-row__value">
                        {p.address.street} {p.address.building_number}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-row__label">Miejscowość</span>
                      <span className="info-row__value">
                        {p.address.postal_code} {p.address.city}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-row__label">Kraj</span>
                      <span className="info-row__value">{p.address.country}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Wkrótce */}
              <div className="info-card info-card--muted">
                <div className="info-card__header">
                  <span className="info-card__icon">🚀</span>
                  <h2 className="info-card__title">Wkrótce</h2>
                </div>
                <div className="info-card__body">
                  <p className="info-card__coming-soon">
                    Zarządzanie menu, rezerwacjami i opiniami gości będzie dostępne w kolejnych aktualizacjach panelu.
                  </p>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  )
}