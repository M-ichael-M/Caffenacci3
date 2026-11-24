import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import CityLinks from './components/CityLinks'
import TopBar from './components/TopBar'
import { loadClientAuth, saveClientAuth, clearClientAuth } from './authStorage'
import type { ClientAuthState } from './authStorage'
import { SESSION_EXPIRED_EVENT } from './sessionGuard'
import logoCircle from './assets/logo/logo_circle.png'
import './index.css'
import { API_URL, COMPANY_URL } from './config'
import { useI18n } from './i18n/I18nProvider'
import { LanguageToggle } from './i18n/siteLanguage'
import './utils/sitePaths'

const LoginForm        = lazy(() => import('./components/LoginForm'))
const RegisterForm     = lazy(() => import('./components/RegisterForm'))
const AccountDashboard = lazy(() => import('./components/AccountDashboard'))
const HomePage         = lazy(() => import('./components/HomePage'))
const CafePage         = lazy(() => import('./components/CafePage/CafePage'))

const Spinner = () => <div className="session-check"><div className="loading-spinner" /></div>
const PageSpinner = () => <div className="loading-state" style={{ minHeight: '60vh' }}><div className="loading-spinner" /></div>

type View = 'home' | 'login' | 'register' | 'account'

function getCafeIdFromPath(): string | null {
  const m = window.location.pathname.match(/^\/(?:kawiarnia|cafe)\/([^/]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

function getPreviewParamsFromPath(): { cafeId: string; token: string } | null {
  const m = window.location.pathname.match(/^\/preview\/([^/]+)/)
  if (!m) return null
  const cafeId = decodeURIComponent(m[1])
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  return { cafeId, token }
}

export default function App() {
  const { t } = useI18n()
  const cafeIdFromUrl = getCafeIdFromPath()
  const previewParams = getPreviewParamsFromPath()
  const listing = window.__LISTING__
  const homeInitial = listing
    ? { query: listing.city, country: listing.country, badges: listing.badge ? [listing.badge] : [] }
    : undefined

  const [view, setView] = useState<View>(() =>
    new URLSearchParams(window.location.search).get('konto') === '1' ? 'account' : 'home')
  const viewRef = useRef(view)
  const [auth, setAuth] = useState<ClientAuthState | null>(null)
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => { viewRef.current = view }, [view])

  useEffect(() => {
    const onExpired = () => {
      setAuth(null)
      if (viewRef.current === 'account') {
        setSessionExpired(true)
        setView('login')
      }
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

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
    fetch(`${API_URL}/client-auth/me`, { headers: { Authorization: `Bearer ${stored.token}` } })
      .then(res => {
        if (res.ok) setAuth(stored)
        else clearClientAuth()
      })
      .catch(() => { setAuth(stored) })
      .finally(() => setCheckingSession(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLoginSuccess(data: { access_token: string; user_id: string; nick: string; full_name: string }) {
    const state: ClientAuthState = {
      token: data.access_token, user_id: data.user_id, nick: data.nick, full_name: data.full_name,
    }
    saveClientAuth(state)
    setSessionExpired(false)
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

  if (previewParams) {
    return <Suspense fallback={<Spinner />}><CafePage identifier={previewParams.cafeId} mode="preview" previewToken={previewParams.token} /></Suspense>
  }
  if (cafeIdFromUrl) {
    return <Suspense fallback={<Spinner />}><CafePage identifier={cafeIdFromUrl} mode="public" /></Suspense>
  }
  if (checkingSession) {
    return <div className="session-check"><div className="loading-spinner" /></div>
  }

  const authBrand = (
    <aside className="auth-brand">
      <div className="auth-brand__rings" aria-hidden="true" />
      <div className="auth-brand__content">
        <img src={logoCircle} alt="Caffenacci" className="auth-brand__logo" />
        <div className="auth-brand__rule" />
        <h1 className="auth-brand__wordmark">Caffenacci</h1>
        <p className="auth-brand__tagline">{t('app.guest_account')}</p>
        <div className="auth-brand__sep" />
        <p className="auth-brand__description">{t('app.brand_desc')}</p>
      </div>
      <div className="auth-brand__footer">© {new Date().getFullYear()} Caffenacci</div>
    </aside>
  )

  const backHome = (
    <p className="cross-app-link" style={{ display: 'flex', justifyContent: 'center' }}>
      <button
        type="button"
        className="link-btn"
        onClick={() => setView('home')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
      >
        <ArrowLeft size={14} /> {t('app.back_home')}
      </button>
    </p>
  )

  if (view === 'login') {
    return (
      <div className="auth-layout">
        {authBrand}
        <main className="auth-form-panel">
          <div className="auth-form-container">
            <div className="auth-lang"><LanguageToggle variant="light" /></div>
            <Suspense fallback={<Spinner />}>
              <LoginForm
                onSuccess={handleLoginSuccess}
                onSwitchToRegister={() => { setRegisterSuccess(false); setView('register') }}
                registerSuccess={registerSuccess}
                sessionExpired={sessionExpired}
              />
            </Suspense>
            {backHome}
          </div>
        </main>
      </div>
    )
  }

  if (view === 'register') {
    return (
      <div className="auth-layout">
        {authBrand}
        <main className="auth-form-panel">
          <div className="auth-form-container">
            <div className="auth-lang"><LanguageToggle variant="light" /></div>
            <Suspense fallback={<Spinner />}>
              <RegisterForm onSuccess={handleRegisterSuccess} onSwitchToLogin={() => setView('login')} />
            </Suspense>
            {backHome}
          </div>
        </main>
      </div>
    )
  }

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
        <Suspense fallback={<Spinner />}><AccountDashboard auth={auth as ClientAuthState} /></Suspense>
      ) : (
        <>
          <Suspense fallback={<PageSpinner />}>
            <HomePage token={auth?.token ?? null} initial={homeInitial} />
          </Suspense>
          <CityLinks />
          <p
            className="cross-app-link"
            style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}
          >
            {t('app.owner_q')}{' '}
            <a href={COMPANY_URL} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              {t('app.owner_link')} <ArrowRight size={14} />
            </a>
          </p>
        </>
      )}
    </div>
  )
}
