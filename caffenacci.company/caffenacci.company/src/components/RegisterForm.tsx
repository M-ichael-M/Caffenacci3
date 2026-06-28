import { useState } from 'react'

interface FormData {
  owner_name: string
  cafe_name: string
  email: string
  phone: string
  password: string
  country: string
  city: string
  street: string
  building_number: string
  postal_code: string
  terms: boolean
  marketing: boolean
}

type FieldErrors = Partial<Record<keyof FormData, string>>

interface Props {
  onSuccess: () => void
  onSwitchToLogin: () => void
}

const INITIAL: FormData = {
  owner_name: '',
  cafe_name: '',
  email: '',
  phone: '',
  password: '',
  country: 'Polska',
  city: '',
  street: '',
  building_number: '',
  postal_code: '',
  terms: false,
  marketing: false,
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: Props) {
  const [form, setForm] = useState<FormData>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => ({ ...prev, [key]: undefined }))
  }

  const validate = (): boolean => {
    const e: FieldErrors = {}
    if (!form.owner_name.trim())         e.owner_name       = 'Podaj imię i nazwisko'
    if (!form.cafe_name.trim())          e.cafe_name        = 'Podaj nazwę kawiarni'
    if (!isValidEmail(form.email))       e.email            = 'Podaj prawidłowy adres e-mail'
    if (!form.phone.trim())              e.phone            = 'Podaj numer telefonu'
    if (form.password.length < 8)        e.password         = 'Hasło musi mieć co najmniej 8 znaków'
    if (!form.street.trim())             e.street           = 'Podaj ulicę'
    if (!form.building_number.trim())    e.building_number  = 'Podaj numer'
    if (!form.postal_code.trim())        e.postal_code      = 'Podaj kod pocztowy'
    if (!form.city.trim())               e.city             = 'Podaj miasto'
    if (!form.terms)                     e.terms            = 'Akceptacja regulaminu jest wymagana'
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setLoading(true)

    try {
      const res = await fetch('http://localhost:8000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_name: form.owner_name,
          cafe_name: form.cafe_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          address: {
            country: form.country,
            city: form.city,
            street: form.street,
            building_number: form.building_number,
            postal_code: form.postal_code,
          },
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
        <h2 className="form-title">Zarejestruj kawiarnię</h2>
        <p className="form-subtitle">Dołącz do Caffenacci i zacznij zarządzać swoim lokalem</p>
      </div>

      <form onSubmit={handleSubmit} className="form" noValidate>

        {/* ── Właściciel ── */}
        <div className="form-section">
          <span className="form-section__label">Właściciel</span>

          <div className="field">
            <label className="field__label" htmlFor="reg-owner_name">Imię i nazwisko</label>
            <input
              id="reg-owner_name"
              type="text"
              className={`field__input${fe.owner_name ? ' field__input--error' : ''}`}
              value={form.owner_name}
              onChange={e => set('owner_name', e.target.value)}
              placeholder="Jan Kowalski"
              autoComplete="name"
            />
            {fe.owner_name && <span className="field__error">{fe.owner_name}</span>}
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
                placeholder="jan@kawiarnia.pl"
                autoComplete="email"
              />
              {fe.email && <span className="field__error">{fe.email}</span>}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="reg-phone">Telefon</label>
              <input
                id="reg-phone"
                type="tel"
                className={`field__input${fe.phone ? ' field__input--error' : ''}`}
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+48 123 456 789"
                autoComplete="tel"
              />
              {fe.phone && <span className="field__error">{fe.phone}</span>}
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="reg-password">Hasło</label>
            <input
              id="reg-password"
              type="password"
              className={`field__input${fe.password ? ' field__input--error' : ''}`}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder="Min. 8 znaków, wielkie litery, cyfry, znaki specjalne"
              autoComplete="new-password"
            />
            {fe.password && <span className="field__error">{fe.password}</span>}
          </div>
        </div>

        {/* ── Kawiarnia ── */}
        <div className="form-section">
          <span className="form-section__label">Kawiarnia</span>

          <div className="field">
            <label className="field__label" htmlFor="reg-cafe_name">Nazwa kawiarni</label>
            <input
              id="reg-cafe_name"
              type="text"
              className={`field__input${fe.cafe_name ? ' field__input--error' : ''}`}
              value={form.cafe_name}
              onChange={e => set('cafe_name', e.target.value)}
              placeholder="Kawiarnia Pod Lipą"
            />
            {fe.cafe_name && <span className="field__error">{fe.cafe_name}</span>}
          </div>
        </div>

        {/* ── Adres ── */}
        <div className="form-section">
          <span className="form-section__label">Adres kawiarni</span>

          <div className="field-row">
            <div className="field field--grow">
              <label className="field__label" htmlFor="reg-street">Ulica</label>
              <input
                id="reg-street"
                type="text"
                className={`field__input${fe.street ? ' field__input--error' : ''}`}
                value={form.street}
                onChange={e => set('street', e.target.value)}
                placeholder="Marszałkowska"
                autoComplete="street-address"
              />
              {fe.street && <span className="field__error">{fe.street}</span>}
            </div>

            <div className="field field--small">
              <label className="field__label" htmlFor="reg-building_number">Nr</label>
              <input
                id="reg-building_number"
                type="text"
                className={`field__input${fe.building_number ? ' field__input--error' : ''}`}
                value={form.building_number}
                onChange={e => set('building_number', e.target.value)}
                placeholder="12A"
              />
              {fe.building_number && <span className="field__error">{fe.building_number}</span>}
            </div>
          </div>

          <div className="field-row">
            <div className="field field--small">
              <label className="field__label" htmlFor="reg-postal_code">Kod pocztowy</label>
              <input
                id="reg-postal_code"
                type="text"
                className={`field__input${fe.postal_code ? ' field__input--error' : ''}`}
                value={form.postal_code}
                onChange={e => set('postal_code', e.target.value)}
                placeholder="00-001"
                autoComplete="postal-code"
              />
              {fe.postal_code && <span className="field__error">{fe.postal_code}</span>}
            </div>

            <div className="field field--grow">
              <label className="field__label" htmlFor="reg-city">Miasto</label>
              <input
                id="reg-city"
                type="text"
                className={`field__input${fe.city ? ' field__input--error' : ''}`}
                value={form.city}
                onChange={e => set('city', e.target.value)}
                placeholder="Warszawa"
                autoComplete="address-level2"
              />
              {fe.city && <span className="field__error">{fe.city}</span>}
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="reg-country">Kraj</label>
            <input
              id="reg-country"
              type="text"
              className="field__input"
              value={form.country}
              onChange={e => set('country', e.target.value)}
              placeholder="Polska"
              autoComplete="country-name"
            />
          </div>
        </div>

        {/* ── Zgody ── */}
        <div className="form-section">
          <span className="form-section__label">Zgody</span>

          <div>
            <div className="checkbox-field">
              <input
                type="checkbox"
                id="reg-terms"
                className="checkbox-field__input"
                checked={form.terms}
                onChange={e => set('terms', e.target.checked)}
              />
              <label htmlFor="reg-terms" className="checkbox-field__label">
                Akceptuję{' '}
                <a
                  href="/regulamin"
                  className="link"
                  onClick={e => e.preventDefault()}
                >
                  Regulamin serwisu Caffenacci
                </a>
                {' '}<span className="required-mark">*</span>
              </label>
            </div>
            {fe.terms && <p className="checkbox-error">{fe.terms}</p>}
          </div>

          <div className="checkbox-field">
            <input
              type="checkbox"
              id="reg-marketing"
              className="checkbox-field__input"
              checked={form.marketing}
              onChange={e => set('marketing', e.target.checked)}
            />
            <label htmlFor="reg-marketing" className="checkbox-field__label">
              Wyrażam zgodę na{' '}
              <a
                href="/zgoda-marketingowa"
                className="link"
                onClick={e => e.preventDefault()}
              >
                otrzymywanie informacji marketingowych
              </a>
            </label>
          </div>
        </div>

        {error && (
          <div className="form-error" role="alert">{error}</div>
        )}

        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Rejestracja…' : 'Zarejestruj kawiarnię'}
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