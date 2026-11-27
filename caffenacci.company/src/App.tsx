import { useState, useEffect } from 'react'
import LoginForm from './components/LoginForm'
import RegisterForm from './components/RegisterForm'
import Dashboard from './components/Dashboard'
import LanguageSwitcher from './components/LanguageSwitcher'
import Landing from './landing/Landing'
import logoTransparent from './assets/logo/logo_transparent.png'
import './index.css'
import { ArrowRight } from 'lucide-react'
import { API_URL, CUSTOMER_URL } from './config'
import { useI18n } from './i18n'
import { CafeSettingsProvider } from './components/CafeSettingsContext'
import { loadAuth, saveAuth, clearAuth, type AuthState } from './authStorage'
import { SESSION_EXPIRED_EVENT } from './sessionGuard'

type View = 'landing' | 'login' | 'register' | 'dashboard'

export type { AuthState } from './authStorage'

// Landing: "/" (PL) i "/en" (EN). Logowanie i rejestracja: "#logowanie" / "#rejestracja".
function viewFromHash(): View {
  const h = window.location.hash
  return h === '#rejestracja' ? 'register' : h === '#logowanie' ? 'login' : 'landing'
}
const landingLang = () => (window.location.pathname.replace(/\/+$/, '') === '/en' ? 'en' : 'pl')
const setHash = (h: string) => history.replaceState(null, '', window.location.pathname + h)

export default function App() {
  const { t } = useI18n()
  const [auth, setAuth] = useState<AuthState | null>(loadAuth)
  const [view, setView] = useState<View>(() => (loadAuth() ? 'dashboard' : viewFromHash()))
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  function goTo(v: 'landing' | 'login' | 'register') {
    setHash(v === 'login' ? '#logowanie' : v === 'register' ? '#rejestracja' : '')
    setView(v)
  }

  useEffect(() => {
    const onExpired = () => {
      setAuth(null)
      setProfile(null)
      goTo('login')
      setSessionExpired(true)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  // Linki z landingu (#rejestracja / #logowanie) i przyciski wstecz/dalej
  useEffect(() => {
    const onHash = () => { if (!loadAuth()) setView(viewFromHash()) }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Odtworzenie sesji
  useEffect(() => {
    if (auth) fetchProfile(auth.token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchProfile(token: string) {
    setLoadingProfile(true)
    try {
      const res = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        setProfile(await res.json())
      } else {
        handleLogout()
      }
    } catch {
      // brak sieci — zostajemy w panelu z zapisanymi danymi
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
    setSessionExpired(false)
    setAuth(state)
    setHash('')
    setView('dashboard')
    fetchProfile(data.access_token)
  }

  function handleRegisterSuccess() {
    setRegisterSuccess(true)
    goTo('login')
  }

  function handleLogout() {
    clearAuth()
    setAuth(null)
    setProfile(null)
    goTo('login')
  }

  // ── Dashboard ──────────────────────────────────
  if (view === 'dashboard' && auth) {
    return (
      <CafeSettingsProvider token={auth.token}>
        <Dashboard
          auth={auth}
          profile={profile}
          loadingProfile={loadingProfile}
          onLogout={handleLogout}
        />
      </CafeSettingsProvider>
    )
  }

  // ── Landing ────────────────────────────────────
  if (view === 'landing') return <Landing lang={landingLang()} />

  // ── Logowanie / rejestracja ────────────────────
  return (
    <div className="auth-layout">
      <aside className="auth-brand">
        <div className="auth-brand__rings" aria-hidden="true" />

        <div className="auth-brand__content">
          <a href={landingLang() === 'en' ? '/en' : '/'} aria-label="Caffenacci">
            <img src={logoTransparent} alt="Caffenacci" className="auth-brand__logo" />
          </a>
          <div className="auth-brand__rule" />
          <h1 className="auth-brand__wordmark" translate="no">Caffenacci</h1>
          <p className="auth-brand__tagline">{t('app.tagline')}</p>
          <div className="auth-brand__sep" />
          <p className="auth-brand__description">{t('app.description')}</p>
        </div>

        <div className="auth-brand__footer">
          © {new Date().getFullYear()} Caffenacci
        </div>
      </aside>

      <main className="auth-form-panel">
        <div className="auth-form-container">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <LanguageSwitcher />
          </div>

          {view === 'login' ? (
            <LoginForm
              onSuccess={handleLoginSuccess}
              onSwitchToRegister={() => { setRegisterSuccess(false); goTo('register') }}
              registerSuccess={registerSuccess}
              sessionExpired={sessionExpired}
            />
          ) : (
            <RegisterForm
              onSuccess={handleRegisterSuccess}
              onSwitchToLogin={() => goTo('login')}
            />
          )}
          <p className="cross-app-link" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem' }}>
            {t('app.crossLink.question')}{' '}
            <a href={CUSTOMER_URL} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              {t('app.crossLink.cta')} <ArrowRight size={14} />
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}