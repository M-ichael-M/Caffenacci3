import { useState } from 'react'

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('http://localhost:8000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Nieprawidłowy e-mail lub hasło.')
      }
      onSuccess(data as LoginResponse)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="form-wrapper">
      <div className="form-header">
        <h2 className="form-title">Zaloguj się</h2>
        <p className="form-subtitle">Witaj z powrotem w panelu Caffenacci</p>
      </div>

      {registerSuccess && (
        <div className="form-success" role="status">
          Konto zostało pomyślnie utworzone. Możesz się teraz zalogować.
        </div>
      )}

      <form onSubmit={handleSubmit} className="form" noValidate>
        <div className="field">
          <label className="field__label" htmlFor="login-email">Adres e-mail</label>
          <input
            id="login-email"
            type="email"
            className="field__input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jan@kawiarnia.pl"
            autoComplete="email"
            required
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="login-password">Hasło</label>
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
          {loading ? 'Logowanie…' : 'Zaloguj się'}
        </button>
      </form>

      <div className="form-switch">
        <p>
          Nie masz jeszcze konta?{' '}
          <button type="button" className="link-btn" onClick={onSwitchToRegister}>
            Zarejestruj kawiarnię
          </button>
        </p>
      </div>
    </div>
  )
}