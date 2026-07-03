import { useState, useEffect, useRef } from 'react'

interface FormData {
  full_name: string
  nick: string
  email: string
  phone: string
  password: string
  password_confirm: string
  accept_terms: boolean
  accept_privacy: boolean
}

type FieldErrors = Partial<Record<keyof FormData, string>>
type NickStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'

interface Props {
  onSuccess: () => void
  onSwitchToLogin: () => void
}

const INITIAL: FormData = {
  full_name: '',
  nick: '',
  email: '',
  phone: '',
  password: '',
  password_confirm: '',
  accept_terms: false,
  accept_privacy: false,
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: Props) {
  const [form, setForm] = useState<FormData>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [nickStatus, setNickStatus] = useState<NickStatus>('idle')
  const nickCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => ({ ...prev, [key]: undefined }))
  }

  // ── Sprawdzanie dostępności nicku na żywo ──────────────────────────────
  useEffect(() => {
    if (nickCheckTimer.current) clearTimeout(nickCheckTimer.current)

    const nick = form.nick.trim()
    if (nick.length < 3) {
      setNickStatus('idle')
      return
    }

    setNickStatus('checking')
    nickCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/client-auth/nick-available?nick=${encodeURIComponent(nick)}`
        )
        if (!res.ok) throw new Error()
        const data = await res.json()
        setNickStatus(data.available ? 'available' : 'taken')
      } catch {
        setNickStatus('error')
      }
    }, 450)

    return () => {
      if (nickCheckTimer.current) clearTimeout(nickCheckTimer.current)
    }
  }, [form.nick])

  const validate = (): boolean => {
    const e: FieldErrors = {}
    if (!form.full_name.trim())                  e.full_name         = 'Podaj imię i nazwisko'
    if (form.nick.trim().length < 3)              e.nick              = 'Nick musi mieć co najmniej 3 znaki'
    else if (nickStatus === 'taken')              e.nick              = 'Ten nick jest już zajęty'
    if (!isValidEmail(form.email))                e.email             = 'Podaj prawidłowy adres e-mail'
    if (form.password.length < 8)                 e.password          = 'Hasło musi mieć co najmniej 8 znaków'
    if (form.password_confirm !== form.password)  e.password_confirm  = 'Hasła nie są identyczne'
    if (!form.accept_terms)                       e.accept_terms      = 'Akceptacja regulaminu jest wymagana'
    if (!form.accept_privacy)                     e.accept_privacy    = 'Akceptacja polityki prywatności jest wymagana'
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setLoading(true)

    try {
      const res = await fetch('http://localhost:8000/client-auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          nick: form.nick,
          email: form.email,
          phone: form.phone || null,
          password: form.password,
          password_confirm: form.password_confirm,
          accept_terms: form.accept_terms,
          accept_privacy: form.accept_privacy,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.detail || 'Błąd rejestracji. Sprawdź dane i spróbuj ponownie.')
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  const fe = fieldErrors

  return (
    <div className="form-wrapper">
      <div className="form-header">
        <h2 className="form-title">Załóż konto</h2>
        <p className="form-subtitle">Dołącz do Caffenacci jako gość i korzystaj z ulubionych kawiarni</p>
      </div>

      <form onSubmit={handleSubmit} className="form" noValidate>

        {/* ── Dane podstawowe ── */}
        <div className="form-section">
          <span className="form-section__label">Dane podstawowe</span>

          <div className="field">
            <label className="field__label" htmlFor="reg-full_name">Imię i nazwisko</label>
            <input
              id="reg-full_name"
              type="text"
              className={`field__input${fe.full_name ? ' field__input--error' : ''}`}
              value={form.full_name}
              onChange={e => set('full_name', e.target.value)}
              placeholder="Anna Kowalska"
              autoComplete="name"
            />
            {fe.full_name && <span className="field__error">{fe.full_name}</span>}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="reg-nick">Nick</label>
            <input
              id="reg-nick"
              type="text"
              className={`field__input${fe.nick ? ' field__input--error' : ''}`}
              value={form.nick}
              onChange={e => set('nick', e.target.value)}
              placeholder="anna_k"
              autoComplete="username"
            />
            {fe.nick ? (
              <span className="field__error">{fe.nick}</span>
            ) : nickStatus === 'checking' ? (
              <span className="field__hint">Sprawdzanie dostępności…</span>
            ) : nickStatus === 'available' ? (
              <span className="field__hint field__hint--ok">✓ Nick dostępny</span>
            ) : nickStatus === 'taken' ? (
              <span className="field__error">Ten nick jest już zajęty</span>
            ) : null}
          </div>

          <div className="field-row">
            <div className="field field--grow">
              <label className="field__label" htmlFor="reg-email">E-mail</label>
              <input
                id="reg-email"
                type="email"
                className={`field__input${fe.email ? ' field__input--error' : ''}`}
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="anna@przyklad.pl"
                autoComplete="email"
              />
              {fe.email && <span className="field__error">{fe.email}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="reg-phone">Telefon (opcjonalnie)</label>
              <input
                id="reg-phone"
                type="tel"
                className="field__input"
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+48 123 456 789"
                autoComplete="tel"
              />
            </div>
          </div>
        </div>

        {/* ── Hasło ── */}
        <div className="form-section">
          <span className="form-section__label">Hasło</span>

          <div className="field">
            <label className="field__label" htmlFor="reg-password">Hasło</label>
            <input
              id="reg-password"
              type="password"
              className={`field__input${fe.password ? ' field__input--error' : ''}`}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="Min. 8 znaków"
              autoComplete="new-password"
            />
            {fe.password && <span className="field__error">{fe.password}</span>}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="reg-password_confirm">Powtórz hasło</label>
            <input
              id="reg-password_confirm"
              type="password"
              className={`field__input${fe.password_confirm ? ' field__input--error' : ''}`}
              value={form.password_confirm}
              onChange={e => set('password_confirm', e.target.value)}
              placeholder="Powtórz hasło"
              autoComplete="new-password"
            />
            {fe.password_confirm && <span className="field__error">{fe.password_confirm}</span>}
          </div>
        </div>

        {/* ── Zgody ── */}
        <div className="form-section">
          <span className="form-section__label">Zgody</span>

          <div>
            <div className="checkbox-field">
              <input
                type="checkbox"
                id="reg-accept_terms"
                className="checkbox-field__input"
                checked={form.accept_terms}
                onChange={e => set('accept_terms', e.target.checked)}
              />
              <label htmlFor="reg-accept_terms" className="checkbox-field__label">
                Akceptuję{' '}
                <a href="/regulamin" className="link" onClick={e => e.preventDefault()}>
                  Regulamin serwisu Caffenacci
                </a>
                {' '}<span className="required-mark">*</span>
              </label>
            </div>
            {fe.accept_terms && <p className="checkbox-error">{fe.accept_terms}</p>}
          </div>

          <div>
            <div className="checkbox-field">
              <input
                type="checkbox"
                id="reg-accept_privacy"
                className="checkbox-field__input"
                checked={form.accept_privacy}
                onChange={e => set('accept_privacy', e.target.checked)}
              />
              <label htmlFor="reg-accept_privacy" className="checkbox-field__label">
                Akceptuję{' '}
                <a href="/polityka-prywatnosci" className="link" onClick={e => e.preventDefault()}>
                  Politykę prywatności Caffenacci
                </a>
                {' '}<span className="required-mark">*</span>
              </label>
            </div>
            {fe.accept_privacy && <p className="checkbox-error">{fe.accept_privacy}</p>}
          </div>
        </div>

        {error && (
          <div className="form-error" role="alert">{error}</div>
        )}

        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Rejestracja…' : 'Załóż konto'}
        </button>

        <p className="form-note">
          Pola oznaczone <span className="required-mark">*</span> są obowiązkowe.
        </p>
      </form>

      <div className="form-switch">
        <p>
          Masz już konto?{' '}
          <button type="button" className="link-btn" onClick={onSwitchToLogin}>
            Zaloguj się
          </button>
        </p>
      </div>
    </div>
  )
}