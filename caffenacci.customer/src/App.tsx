import { useState, useEffect } from 'react'
import LoginForm from './components/LoginForm'
import RegisterForm from './components/RegisterForm'
import AccountHome from './components/AccountHome'
import './index.css'

type View = 'login' | 'register' | 'account'

export interface ClientAuthState {
  token: string
  user_id: string
  nick: string
  full_name: string
}

const STORAGE_KEYS = {
  token:     'caffenacci_client_token',
  user_id:   'caffenacci_client_user_id',
  nick:      'caffenacci_client_nick',
  full_name: 'caffenacci_client_full_name',
} as const

function saveAuth(data: ClientAuthState) {
  localStorage.setItem(STORAGE_KEYS.token,     data.token)
  localStorage.setItem(STORAGE_KEYS.user_id,   data.user_id)
  localStorage.setItem(STORAGE_KEYS.nick,      data.nick)
  localStorage.setItem(STORAGE_KEYS.full_name, data.full_name)
}

function clearAuth() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
}

function loadAuth(): ClientAuthState | null {
  const token     = localStorage.getItem(STORAGE_KEYS.token)
  const user_id   = localStorage.getItem(STORAGE_KEYS.user_id)
  const nick      = localStorage.getItem(STORAGE_KEYS.nick)
  const full_name = localStorage.getItem(STORAGE_KEYS.full_name)
  if (token && user_id && nick && full_name) {
    return { token, user_id, nick, full_name }
  }
  return null
}

export default function App() {
  const [view, setView] = useState<View>('login')
  const [auth, setAuth] = useState<ClientAuthState | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // Przywróć sesję przy starcie
  useEffect(() => {
    const stored = loadAuth()
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
          setView('account')
        } else {
          clearAuth()
        }
      })
      .catch(() => {
        // Błąd sieci — pokaż dane z pamięci, nie wylogowuj na siłę
        setAuth(stored)
        setView('account')
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
    saveAuth(state)
    setAuth(state)
    setView('account')
  }

  function handleRegisterSuccess() {
    setRegisterSuccess(true)
    setView('login')
  }

  function handleLogout() {
    clearAuth()
    setAuth(null)
    setView('login')
  }

  if (checkingSession) {
    return (
      <div className="session-check">
        <div className="loading-spinner" />
      </div>
    )
  }

  // ── Konto ──────────────────────────────────────
  if (view === 'account' && auth) {
    return <AccountHome auth={auth} onLogout={handleLogout} />
  }

  // ── Auth layout ────────────────────────────────
  return (
    <div className="auth-layout">
      <aside className="auth-brand">
        <div className="auth-brand__rings" aria-hidden="true" />

        <div className="auth-brand__content">
          <div className="auth-brand__rule" />
          <h1 className="auth-brand__wordmark">Caffenacci</h1>
          <p className="auth-brand__tagline">Konto gościa</p>
          <div className="auth-brand__sep" />
          <p className="auth-brand__description">
            Rezerwuj stoliki, zamawiaj online i zostawiaj opinie w swoich ulubionych kawiarniach — wszystko na jednym koncie.
          </p>
        </div>

        <div className="auth-brand__footer">
          © {new Date().getFullYear()} Caffenacci
        </div>
      </aside>

      <main className="auth-form-panel">
        <div className="auth-form-container">
          {view === 'login' ? (
            <LoginForm
              onSuccess={handleLoginSuccess}
              onSwitchToRegister={() => { setRegisterSuccess(false); setView('register') }}
              registerSuccess={registerSuccess}
            />
          ) : (
            <RegisterForm
              onSuccess={handleRegisterSuccess}
              onSwitchToLogin={() => setView('login')}
            />
          )}

          <p className="cross-app-link">
            Prowadzisz kawiarnię?{' '}
            <a href="http://localhost:5173">Przejdź do panelu właściciela →</a>
          </p>
        </div>
      </main>
    </div>
  )
}