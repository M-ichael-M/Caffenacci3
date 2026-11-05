import { useState } from 'react'
import { API_URL } from '../config'
import { useI18n } from '../i18n/I18nProvider'

interface LoginResponse {
  access_token: string
  token_type: string
  user_id: string
  nick: string
  full_name: string
}

interface Props {
  onSuccess: (data: LoginResponse) => void
  onSwitchToRegister: () => void
  registerSuccess?: boolean
}

export default function LoginForm({ onSuccess, onSwitchToRegister, registerSuccess }: Props) {
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/client-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || t('login.err_credentials'))
      }
      onSuccess(data as LoginResponse)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('login.err_unexpected'))
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
            placeholder={t('login.email')}
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
            placeholder={t('login.password')}
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
          {t('login.no_account')}{' '}
          <button type="button" className="link-btn" onClick={onSwitchToRegister}>
            {t('login.create')}
          </button>
        </p>
      </div>
    </div>
  )
}