import { useState, useEffect } from 'react'
import LoginForm from './components/LoginForm'
import RegisterForm from './components/RegisterForm'
import Dashboard from './components/Dashboard'
import './index.css'

type View = 'login' | 'register' | 'dashboard'

export interface AuthState {
  token: string
  cafe_id: string
  cafe_name: string
  owner_name: string
}

const STORAGE_KEYS = {
  token:      'caffenacci_token',
  cafe_id:    'caffenacci_cafe_id',
  cafe_name:  'caffenacci_cafe_name',
  owner_name: 'caffenacci_owner_name',
} as const

function saveAuth(data: AuthState) {
  localStorage.setItem(STORAGE_KEYS.token,      data.token)
  localStorage.setItem(STORAGE_KEYS.cafe_id,    data.cafe_id)
  localStorage.setItem(STORAGE_KEYS.cafe_name,  data.cafe_name)
  localStorage.setItem(STORAGE_KEYS.owner_name, data.owner_name)
}

function clearAuth() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k))
}

function loadAuth(): AuthState | null {
  const token      = localStorage.getItem(STORAGE_KEYS.token)
  const cafe_id    = localStorage.getItem(STORAGE_KEYS.cafe_id)
  const cafe_name  = localStorage.getItem(STORAGE_KEYS.cafe_name)
  const owner_name = localStorage.getItem(STORAGE_KEYS.owner_name)
  if (token && cafe_id && cafe_name && owner_name) {
    return { token, cafe_id, cafe_name, owner_name }
  }
  return null
}

export default function App() {
  const [view, setView] = useState<View>('login')
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)

  // Restore session on mount
  useEffect(() => {
    const stored = loadAuth()
    if (stored) {
      setAuth(stored)
      setView('dashboard')
      fetchProfile(stored.token)
    }
  }, [])

  async function fetchProfile(token: string) {
    setLoadingProfile(true)
    try {
      const res = await fetch('http://localhost:8000/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setProfile(await res.json())
      } else {
        // Token expired or invalid — force logout
        handleLogout()
      }
    } catch {
      // Network error — keep showing dashboard with stored data
    } finally {
      setLoadingProfile(false)
    }
  }

  function handleLoginSuccess(data: {
    access_token: string
    cafe_id: string
    cafe_name: string
    owner_name: string
  }) {
    const state: AuthState = {
      token:      data.access_token,
      cafe_id:    data.cafe_id,
      cafe_name:  data.cafe_name,
      owner_name: data.owner_name,
    }
    saveAuth(state)
    setAuth(state)
    setView('dashboard')
    fetchProfile(data.access_token)
  }

  function handleRegisterSuccess() {
    setRegisterSuccess(true)
    setView('login')
  }

  function handleLogout() {
    clearAuth()
    setAuth(null)
    setProfile(null)
    setView('login')
  }

  // ── Dashboard ──────────────────────────────────
  if (view === 'dashboard' && auth) {
    return (
      <Dashboard
        auth={auth}
        profile={profile}
        loadingProfile={loadingProfile}
        onLogout={handleLogout}
      />
    )
  }

  // ── Auth layout ────────────────────────────────
  return (
    <div className="auth-layout">
      <aside className="auth-brand">
        <div className="auth-brand__rings" aria-hidden="true" />

        <div className="auth-brand__content">
          <div className="auth-brand__rule" />
          <h1 className="auth-brand__wordmark">Caffenacci</h1>
          <p className="auth-brand__tagline">Panel właściciela kawiarni</p>
          <div className="auth-brand__sep" />
          <p className="auth-brand__description">
            Rejestruj swoją kawiarnię, zarządzaj ofertą i buduj relacje z gośćmi — wszystko w jednym miejscu.
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
        </div>
      </main>
    </div>
  )
}