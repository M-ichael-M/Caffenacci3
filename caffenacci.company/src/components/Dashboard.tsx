import { useState, useEffect } from 'react'
import MenuEditor from './MenuEditor'
import ReservationTab from './ReservationTab'

interface AuthState {
  token: string
  cafe_id: string
  cafe_name: string
  owner_name: string
}

interface ServerItem {
  id: string
  name: string
  description?: string
  price: number
  position: number
  is_vege: boolean
  is_hot: boolean
  is_unavailable: boolean
}

interface ServerSection {
  id: string
  name: string
  position: number
  items: ServerItem[]
}

interface MeProfile {
  id?: string
  owner_name?: string
  cafe_name?: string
  email?: string
  phone?: string
  country?: string
  city?: string
  street?: string
  building_number?: string
  postal_code?: string
}

interface Props {
  auth: AuthState
  profile: Record<string, unknown> | null
  loadingProfile: boolean
  onLogout: () => void
}

type TabId = 'overview' | 'menu' | 'reservations'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',     label: 'Przegląd',   icon: '🏠' },
  { id: 'menu',        label: 'Menu',        icon: '📋' },
  { id: 'reservations',label: 'Rezerwacje',  icon: '📅' },
]

export default function Dashboard({ auth, profile, loadingProfile, onLogout }: Props) {
  const p = profile as MeProfile | null
  const cafeName  = p?.cafe_name  ?? auth.cafe_name
  const ownerName = p?.owner_name ?? auth.owner_name
  const cafeId    = p?.id         ?? auth.cafe_id

  const [activeTab, setActiveTab]       = useState<TabId>('overview')
  const [showMenuEditor, setShowMenuEditor] = useState(false)
  const [menuSections, setMenuSections] = useState<ServerSection[]>([])
  const [loadingMenu, setLoadingMenu]   = useState(true)

  useEffect(() => { fetchMenu() }, [])

  async function fetchMenu() {
    setLoadingMenu(true)
    try {
      const res = await fetch('http://localhost:8000/menu', {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setMenuSections(data.sections ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoadingMenu(false) }
  }

  function handleMenuEditorClose() {
    setShowMenuEditor(false)
    fetchMenu()
  }

  const hasMenu = menuSections.length > 0

  return (
    <>
      {showMenuEditor && (
        <MenuEditor token={auth.token} onClose={handleMenuEditorClose} />
      )}

      <div className="dashboard">
        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <header className="dashboard-header">
          <span className="dashboard-header__wordmark">Caffenacci</span>
          <div className="dashboard-header__actions">
            <span className="dashboard-header__greeting">Witaj, {ownerName}</span>
            <button className="btn btn--outline btn--sm" onClick={onLogout}>
              Wyloguj
            </button>
          </div>
        </header>

        {/* ── Tab bar ──────────────────────────────────────────────────── */}
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

        {/* ── Content ──────────────────────────────────────────────────── */}
        <main className="dashboard-main">

          {/* PRZEGLĄD */}
          {activeTab === 'overview' && (
            <div className="dashboard-content">
              <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div className="page-header__eyebrow">Panel kawiarni</div>
                  <h1 className="page-header__title">{cafeName}</h1>
                </div>
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
                  {p && p.street && (
                    <div className="info-card">
                      <div className="info-card__header">
                        <span className="info-card__icon">📍</span>
                        <h2 className="info-card__title">Adres</h2>
                      </div>
                      <div className="info-card__body">
                        <div className="info-row">
                          <span className="info-row__label">Ulica</span>
                          <span className="info-row__value">{p.street} {p.building_number}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-row__label">Miejscowość</span>
                          <span className="info-row__value">{p.postal_code} {p.city}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-row__label">Kraj</span>
                          <span className="info-row__value">{p.country}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Skróty */}
                  <div className="info-card">
                    <div className="info-card__header">
                      <span className="info-card__icon">⚡</span>
                      <h2 className="info-card__title">Szybkie akcje</h2>
                    </div>
                    <div className="info-card__body" style={{ gap: '0.625rem' }}>
                      <button
                        className="btn btn--primary"
                        style={{ width: '100%', padding: '0.75rem' }}
                        onClick={() => setActiveTab('menu')}
                      >
                        📋 {hasMenu ? 'Edytuj menu' : 'Utwórz menu'}
                      </button>
                      <button
                        className="btn btn--outline-dark"
                        style={{ width: '100%', padding: '0.75rem' }}
                        onClick={() => setActiveTab('reservations')}
                      >
                        📅 Zarządzaj rezerwacjami
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MENU */}
          {activeTab === 'menu' && (
            <div className="dashboard-content">
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div className="page-header__eyebrow">Zarządzanie</div>
                  <h1 className="page-header__title">Menu kawiarni</h1>
                </div>
                <button
                  className="btn btn--primary"
                  style={{ width: 'auto', padding: '0.75rem 1.5rem' }}
                  onClick={() => setShowMenuEditor(true)}
                >
                  {hasMenu ? '✏️ Edytuj menu' : '☕ Utwórz menu'}
                </button>
              </div>

              {/* Menu preview */}
              <div className="menu-preview-card">
                <div className="menu-preview-card__header">
                  <div className="menu-preview-card__title-wrap">
                    <span className="info-card__icon">📋</span>
                    <h2 className="info-card__title">Podgląd menu</h2>
                  </div>
                  <button
                    className="btn btn--primary btn--sm"
                    style={{ width: 'auto' }}
                    onClick={() => setShowMenuEditor(true)}
                  >
                    {hasMenu ? 'Edytuj' : 'Utwórz menu'}
                  </button>
                </div>

                <div className="menu-preview-card__body">
                  {loadingMenu ? (
                    <div className="loading-state" style={{ padding: '1.5rem' }}>
                      <div className="loading-spinner" />
                    </div>
                  ) : !hasMenu ? (
                    <div className="menu-empty-state">
                      <p>Menu nie zostało jeszcze utworzone.</p>
                      <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
                        Kliknij „Utwórz menu" aby dodać sekcje i pozycje.
                      </p>
                    </div>
                  ) : (
                    menuSections.map(sec => (
                      <div key={sec.id} className="menu-section-preview">
                        <div className="menu-section-preview__name">{sec.name}</div>
                        {sec.items.map(item => (
                          <div
                            key={item.id}
                            className={`menu-item-preview${item.is_unavailable ? ' menu-item-preview--unavailable' : ''}`}
                          >
                            <div className="menu-item-preview__info">
                              <div className="menu-item-preview__name">
                                {item.name}
                                {item.is_vege && <span className="menu-badge menu-badge--vege">VEGE</span>}
                                {item.is_hot  && <span className="menu-badge menu-badge--hot">HOT</span>}
                                {item.is_unavailable && <span className="menu-badge menu-badge--unavail">NIEDOSTĘPNE</span>}
                              </div>
                              {item.description && (
                                <div className="menu-item-preview__desc">{item.description}</div>
                              )}
                            </div>
                            <div className="menu-item-preview__price">
                              {item.price.toFixed(2)} zł
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* REZERWACJE */}
          {activeTab === 'reservations' && (
            <div className="dashboard-content">
              <ReservationTab token={auth.token} />
            </div>
          )}

        </main>
      </div>
    </>
  )
}