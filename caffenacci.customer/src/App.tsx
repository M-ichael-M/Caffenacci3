import { useState, useEffect } from 'react'
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

export default function App() {
  const cafeIdFromUrl = getCafeIdFromPath()

  const [view, setView] = useState<View>('home')
  const [auth, setAuth] = useState<ClientAuthState | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // Przywróć sesję przy starcie — strona główna zostaje stroną główną
  // niezależnie od tego, czy user jest zalogowany.
  useEffect(() => {
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

  if (checkingSession) {
    return (
      <div className="session-check">
        <div className="loading-spinner" />
      </div>
    )
  }

  // ── Wygenerowana strona kawiarni (/cafe/:id) ────────────────────────
  // Dostępna niezależnie od reszty widoków aplikacji — to osobna,
  // publiczna strona składana na podstawie ustawień właściciela.
  // Nie jest częścią tego redesignu — zostaje bez zmian.
  if (cafeIdFromUrl) {
    return <CafePage identifier={cafeIdFromUrl} mode="public" />
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
            <p className="cross-app-link">
              <button type="button" className="link-btn" onClick={() => setView('home')}>
                ← Wróć do strony głównej
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
            <p className="cross-app-link">
              <button type="button" className="link-btn" onClick={() => setView('home')}>
                ← Wróć do strony głównej
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
          <p className="cross-app-link" style={{ marginBottom: '2rem' }}>
            Prowadzisz kawiarnię?{' '}
            <a href="http://localhost:5173">Przejdź do panelu właściciela →</a>
          </p>
        </>
      )}
    </div>
  )
}
