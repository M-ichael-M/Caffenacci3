import { useState, useEffect } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import LoginForm from './components/LoginForm'
import RegisterForm from './components/RegisterForm'
import AccountDashboard from './components/AccountDashboard'
import HomePage from './components/HomePage'
import TopBar from './components/TopBar'
import CafePage from './components/CafePage/CafePage'
import { loadClientAuth, saveClientAuth, clearClientAuth } from './authStorage'
import type { ClientAuthState } from './authStorage'
import logoCircle from './assets/logo/logo_circle.png'
import './index.css'

type View = 'home' | 'login' | 'register' | 'account'

function getCafeIdFromPath(): string | null {
  const m = window.location.pathname.match(/^\/cafe\/([^/]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

// Podgląd właściciela — /preview/:cafeId?token=... — renderuje dokładnie
// to samo, co /cafe/:slug (ten sam CafePage), tylko przez endpoint
// /site/preview/{cafe_id}, który celowo ignoruje status publikacji
// i subskrypcji (patrz backend/app/routers/site.py).
function getPreviewParamsFromPath(): { cafeId: string; token: string } | null {
  const m = window.location.pathname.match(/^\/preview\/([^/]+)/)
  if (!m) return null
  const cafeId = decodeURIComponent(m[1])
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  return { cafeId, token }
}

export default function App() {
  const cafeIdFromUrl = getCafeIdFromPath()
  const previewParams = getPreviewParamsFromPath()

  const [view, setView] = useState<View>('home')
  const [auth, setAuth] = useState<ClientAuthState | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // Przywracanie sesji — pomijamy je całkowicie dla /cafe/:slug i
  // /preview/:cafeId: obie strony mają własną, niezależną obsługę
  // logowania klienta wewnątrz CafePage i nie muszą czekać na sprawdzenie
  // konta gościa z App.tsx (zbędne opóźnienie i zbędne zapytanie sieciowe
  // w iframie podglądu).
  useEffect(() => {
    if (cafeIdFromUrl || previewParams) {
      setCheckingSession(false)
      return
    }

    const stored = loadClientAuth()
    if (!stored) {
      setCheckingSession(false)
      return
    }

    fetch('http://localhost:8000/client-auth/me', {
      headers: { Authorization: `Bearer ${stored.token}` },
    })
      .then(res => {
        if (res.ok) {
          setAuth(stored)
        } else {
          clearClientAuth()
        }
      })
      .catch(() => {
        setAuth(stored)
      })
      .finally(() => setCheckingSession(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLoginSuccess(data: {
    access_token: string
    user_id: string
    nick: string
    full_name: string
  }) {
    const state: ClientAuthState = {
      token:     data.access_token,
      user_id:   data.user_id,
      nick:      data.nick,
      full_name: data.full_name,
    }
    saveClientAuth(state)
    setAuth(state)
    setView('account')
  }

  function handleRegisterSuccess() {
    setRegisterSuccess(true)
    setView('login')
  }

  function handleLogout() {
    clearClientAuth()
    setAuth(null)
    setView('home')
  }

  // ── Podgląd właściciela (/preview/:cafeId) ──────────────────────────
  // Renderuje się od razu, bez czekania na sesję klienta — to ta sama
  // strona co /cafe/:slug, tylko osadzana w iframie panelu właściciela,
  // niezależnie od tego czy strona jest opublikowana / opłacona.
  if (previewParams) {
    return (
      <CafePage
        identifier={previewParams.cafeId}
        mode="preview"
        previewToken={previewParams.token}
      />
    )
  }

  // ── Wygenerowana strona kawiarni (/cafe/:id) ────────────────────────
  if (cafeIdFromUrl) {
    return <CafePage identifier={cafeIdFromUrl} mode="public" />
  }

  if (checkingSession) {
    return (
      <div className="session-check">
        <div className="loading-spinner" />
      </div>
    )
  }

  // ── Logowanie ──────────────────────────────────
  if (view === 'login') {
    return (
      <div className="auth-layout">
        <aside className="auth-brand">
          <div className="auth-brand__rings" aria-hidden="true" />
          <div className="auth-brand__content">
            <img src={logoCircle} alt="Caffenacci" className="auth-brand__logo" />
            <div className="auth-brand__rule" />
            <h1 className="auth-brand__wordmark">Caffenacci</h1>
            <p className="auth-brand__tagline">Konto gościa</p>
            <div className="auth-brand__sep" />
            <p className="auth-brand__description">
              Rezerwuj stoliki, zamawiaj online i zostawiaj opinie w swoich ulubionych kawiarniach — wszystko na jednym koncie.
            </p>
          </div>
          <div className="auth-brand__footer">© {new Date().getFullYear()} Caffenacci</div>
        </aside>

        <main className="auth-form-panel">
          <div className="auth-form-container">
            <LoginForm
              onSuccess={handleLoginSuccess}
              onSwitchToRegister={() => { setRegisterSuccess(false); setView('register') }}
              registerSuccess={registerSuccess}
            />
            <p className="cross-app-link" style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="link-btn"
                onClick={() => setView('home')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ArrowLeft size={14} /> Wróć do strony głównej
              </button>
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ── Rejestracja ────────────────────────────────
  if (view === 'register') {
    return (
      <div className="auth-layout">
        <aside className="auth-brand">
          <div className="auth-brand__rings" aria-hidden="true" />
          <div className="auth-brand__content">
            <img src={logoCircle} alt="Caffenacci" className="auth-brand__logo" />
            <div className="auth-brand__rule" />
            <h1 className="auth-brand__wordmark">Caffenacci</h1>
            <p className="auth-brand__tagline">Konto gościa</p>
            <div className="auth-brand__sep" />
            <p className="auth-brand__description">
              Rezerwuj stoliki, zamawiaj online i zostawiaj opinie w swoich ulubionych kawiarniach — wszystko na jednym koncie.
            </p>
          </div>
          <div className="auth-brand__footer">© {new Date().getFullYear()} Caffenacci</div>
        </aside>

        <main className="auth-form-panel">
          <div className="auth-form-container">
            <RegisterForm
              onSuccess={handleRegisterSuccess}
              onSwitchToLogin={() => setView('login')}
            />
            <p className="cross-app-link" style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="button"
                className="link-btn"
                onClick={() => setView('home')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ArrowLeft size={14} /> Wróć do strony głównej
              </button>
            </p>
          </div>
        </main>
      </div>
    )
  }

  // ── Konto i Strona główna — obie mają pasek nawigacji ───────────────
  const showAccount = view === 'account' && auth

  return (
    <div className="home-layout">
      <TopBar
        authed={!!auth}
        displayName={auth?.full_name}
        activeView={showAccount ? 'account' : 'home'}
        onLogin={() => setView('login')}
        onRegister={() => { setRegisterSuccess(false); setView('register') }}
        onAccount={() => setView('account')}
        onSearch={() => setView('home')}
        onLogout={handleLogout}
      />

      {showAccount ? (
        <AccountDashboard auth={auth as ClientAuthState} />
      ) : (
        <>
          <HomePage />
          <p
            className="cross-app-link"
            style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}
          >
            Prowadzisz kawiarnię?{' '}
            <a href="http://localhost:5173" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              Przejdź do panelu właściciela <ArrowRight size={14} />
            </a>
          </p>
        </>
      )}
    </div>
  )
}