import { useState } from 'react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'

interface LoginResponse {
  access_token: string
  token_type: string
  cafe_id: string
  cafe_name: string
  owner_name: string
}

interface Props {
  onSuccess: (data: LoginResponse) => void
  onSwitchToRegister: () => void
  registerSuccess?: boolean
}

export default function LoginForm({ onSuccess, onSwitchToRegister, registerSuccess }: Props) {
  const { t, tApi } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(tApi(data.detail, 'login.error'))
        return
      }
      onSuccess(data as LoginResponse)
    } catch {
      setError(t('common.genericError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-wrapper">
      <div className="form-header">
        <h2 className="form-title">{t('login.title')}</h2>
        <p className="form-subtitle">{t('login.subtitle')}</p>
      </div>

      {registerSuccess && (
        <div className="form-success" role="status">
          {t('login.registered')}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form" noValidate>
        <div className="field">
          <label className="field__label" htmlFor="login-email">{t('login.email')}</label>
          <input
            id="login-email"
            type="email"
            className="field__input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('login.emailPlaceholder')}
            autoComplete="email"
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-password">{t('login.password')}</label>
          <input
            id="login-password"
            type="password"
            className="field__input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        {error && (
          <div className="form-error" role="alert">{error}</div>
        )}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={loading || !email || !password}
        >
          {loading ? t('login.submitting') : t('login.submit')}
        </button>
      </form>

      <div className="form-switch">
        <p>
          {t('login.noAccount')}{' '}
          <button type="button" className="link-btn" onClick={onSwitchToRegister}>
            {t('login.registerLink')}
          </button>
        </p>
      </div>
    </div>
  )
}