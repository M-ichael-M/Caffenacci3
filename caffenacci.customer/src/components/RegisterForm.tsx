import { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n/I18nProvider'

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
  const { t } = useI18n()
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
          `${API_URL}/client-auth/nick-available?nick=${encodeURIComponent(nick)}`
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
    if (!form.full_name.trim())                  e.full_name         = t('reg.err_full_name')
    if (form.nick.trim().length < 3)              e.nick              = t('reg.err_nick_short')
    else if (nickStatus === 'taken')              e.nick              = t('reg.nick_taken')
    if (!isValidEmail(form.email))                e.email             = t('reg.err_email')
    if (form.password.length < 8)                 e.password          = t('reg.err_password_short')
    if (form.password_confirm !== form.password)  e.password_confirm  = t('reg.err_password_mismatch')
    if (!form.accept_terms)                       e.accept_terms      = t('reg.err_terms')
    if (!form.accept_privacy)                     e.accept_privacy    = t('reg.err_privacy')
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/client-auth/register`, {
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
        throw new Error(data.detail || t('reg.err_generic'))
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('reg.err_unexpected'))
    } finally {
      setLoading(false)
    }
  }

  const fe = fieldErrors

  return (
    <div className="form-wrapper">
      <div className="form-header">
        <h2 className="form-title">{t('reg.title')}</h2>
        <p className="form-subtitle">{t('reg.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="form" noValidate>

        {/* ── Dane podstawowe ── */}
        <div className="form-section">
          <span className="form-section__label">{t('reg.section_basic')}</span>

          <div className="field">
            <label className="field__label" htmlFor="reg-full_name">{t('reg.full_name')}</label>
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
            <label className="field__label" htmlFor="reg-nick">{t('reg.nick')}</label>
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
              <span className="field__hint">{t('reg.nick_checking')}</span>
            ) : nickStatus === 'available' ? (
              <span className="field__hint field__hint--ok" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <Check size={13} /> {t('reg.nick_ok')}
              </span>
            ) : nickStatus === 'taken' ? (
              <span className="field__error">{t('reg.nick_taken')}</span>
            ) : null}
          </div>

          <div className="field-row">
            <div className="field field--grow">
              <label className="field__label" htmlFor="reg-email">{t('reg.email')}</label>
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
              <label className="field__label" htmlFor="reg-phone">{t('reg.phone_opt')}</label>
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
          <span className="form-section__label">{t('reg.section_password')}</span>

          <div className="field">
            <label className="field__label" htmlFor="reg-password">{t('reg.password')}</label>
            <input
              id="reg-password"
              type="password"
              className={`field__input${fe.password ? ' field__input--error' : ''}`}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder={t('reg.password_ph')}
              autoComplete="new-password"
            />
            {fe.password && <span className="field__error">{fe.password}</span>}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="reg-password_confirm">{t('reg.password_confirm')}</label>
            <input
              id="reg-password_confirm"
              type="password"
              className={`field__input${fe.password_confirm ? ' field__input--error' : ''}`}
              value={form.password_confirm}
              onChange={e => set('password_confirm', e.target.value)}
              placeholder={t('reg.password_confirm_ph')}
              autoComplete="new-password"
            />
            {fe.password_confirm && <span className="field__error">{fe.password_confirm}</span>}
          </div>
        </div>

        {/* ── Zgody ── */}
        <div className="form-section">
          <span className="form-section__label">{t('reg.section_consents')}</span>

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
                {(() => {
                  const [a, b] = t('reg.accept_terms').split('{link}')
                  return (
                    <>
                      {a}
                      <a
                        href="/regulamin"
                        className="link"
                        onClick={e => e.preventDefault()}
                      >
                        {t('reg.terms_link')}
                      </a>
                      {b}
                    </>
                  )
                })()}
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
                {(() => {
                  const [a, b] = t('reg.accept_privacy').split('{link}')
                  return (
                    <>
                      {a}
                      <a
                        href="/polityka-prywatnosci"
                        className="link"
                        onClick={e => e.preventDefault()}
                      >
                        {t('reg.privacy_link')}
                      </a>
                      {b}
                    </>
                  )
                })()}
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
          {loading ? t('reg.submitting') : t('reg.submit')}
        </button>

        <p className="form-note">
          {(() => {
            const [pre, post] = t('reg.required_note').split('*')
            return (
              <>
                {pre}
                <span className="required-mark">*</span>
                {post}
              </>
            )
          })()}
        </p>
      </form>

      <div className="form-switch">
        <p>
          {t('reg.have_account')}{' '}
          <button type="button" className="link-btn" onClick={onSwitchToLogin}>
            {t('reg.login_link')}
          </button>
        </p>
      </div>
    </div>
  )
}