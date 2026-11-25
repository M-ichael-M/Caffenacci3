import { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n/I18nProvider'
import { apiErrorText } from '../i18n/apiError'
import PhoneField from './PhoneField'
import { buildPhone, detectRegion } from '../utils/phone'
import {
  PASSWORD_RULES, checkPassword, isPasswordValid, isPasswordTooLong,
  isValidEmail, isValidNick, normalizeSpaces,
} from '../utils/validation'

interface FormData {
  full_name: string
  nick: string
  email: string
  phone_country: string
  phone: string
  password: string
  password_confirm: string
  accept_terms: boolean
  accept_privacy: boolean
}

type FieldErrors = Partial<Record<keyof FormData, string>>
type AvailStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'

interface Props {
  onSuccess: () => void
  onSwitchToLogin: () => void
}

const INITIAL: FormData = {
  full_name: '',
  nick: '',
  email: '',
  phone_country: 'PL',
  phone: '',
  password: '',
  password_confirm: '',
  accept_terms: false,
  accept_privacy: false,
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: Props) {
  const { t, language } = useI18n()
  const [form, setForm] = useState<FormData>(() => ({ ...INITIAL, phone_country: detectRegion() }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [nickStatus, setNickStatus] = useState<AvailStatus>('idle')
  const [emailStatus, setEmailStatus] = useState<AvailStatus>('idle')
  const pwChecks = checkPassword(form.password)

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => ({ ...prev, [key]: undefined }))
  }

  useEffect(() => {
    const nick = form.nick.trim()
    if (!isValidNick(nick)) { setNickStatus('idle'); return }
    setNickStatus('checking')
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/client-auth/nick-available?nick=${encodeURIComponent(nick)}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error()
        setNickStatus((await res.json()).available ? 'available' : 'taken')
      } catch (err) { if ((err as Error).name !== 'AbortError') setNickStatus('error') }
    }, 450)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [form.nick])

  useEffect(() => {
    const email = form.email.trim().toLowerCase()
    if (!isValidEmail(email)) { setEmailStatus('idle'); return }
    setEmailStatus('checking')
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/client-auth/email-available?email=${encodeURIComponent(email)}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error()
        setEmailStatus((await res.json()).available ? 'available' : 'taken')
      } catch (err) { if ((err as Error).name !== 'AbortError') setEmailStatus('error') }
    }, 450)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [form.email])

  const validate = (): boolean => {
    const e: FieldErrors = {}
    const name = normalizeSpaces(form.full_name)
    const nick = form.nick.trim()
    const email = form.email.trim()

    if (name.length < 2 || name.length > 150)    e.full_name = t('reg.err_full_name')
    if (nick.length < 3)                         e.nick = t('reg.err_nick_short')
    else if (!isValidNick(nick))                 e.nick = t('reg.err_nick_chars')
    else if (nickStatus === 'taken')             e.nick = t('reg.nick_taken')
    if (!isValidEmail(email))                    e.email = t('reg.err_email')
    else if (emailStatus === 'taken')            e.email = t('reg.email_taken')
    if (form.phone && !buildPhone(form.phone_country, form.phone)) e.phone = t('reg.err_phone')
    if (isPasswordTooLong(form.password))        e.password = t('reg.err_password_long')
    else if (!isPasswordValid(form.password))    e.password = t('reg.err_password_weak')
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
          full_name: normalizeSpaces(form.full_name),
          nick: form.nick.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone ? buildPhone(form.phone_country, form.phone) : null,
          password: form.password,
          password_confirm: form.password_confirm,
          accept_terms: form.accept_terms,
          accept_privacy: form.accept_privacy,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(apiErrorText(data?.detail, t, 'reg.err_generic'))
        return
      }
      onSuccess()
    } catch {
      setError(t('reg.err_unexpected'))
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
              maxLength={150}
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
              maxLength={40}
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

          <div className="field">
              <label className="field__label" htmlFor="reg-email">{t('reg.email')}</label>
              <input
                id="reg-email"
                type="email"
                className={`field__input${fe.email ? ' field__input--error' : ''}`}
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="anna@przyklad.pl"
                autoComplete="email"
                maxLength={254}
              />
              {fe.email ? (
                <span className="field__error">{fe.email}</span>
              ) : emailStatus === 'checking' ? (
                <span className="field__hint">{t('reg.email_checking')}</span>
              ) : emailStatus === 'available' ? (
                <span className="field__hint field__hint--ok" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Check size={13} /> {t('reg.email_ok')}
                </span>
              ) : emailStatus === 'taken' ? (
                <span className="field__error">{t('reg.email_taken')}</span>
              ) : null}
          </div>

          <PhoneField
            id="reg-phone"
            label={t('reg.phone_opt')}
            country={form.phone_country}
            national={form.phone}
            locale={language.locale}
            labels={{ country: t('reg.phone_country'), search: t('reg.phone_search'), noResults: t('reg.phone_none') }}
            placeholder={t('reg.phone_ph')}
            error={fe.phone}
            onChange={(country, national) => {
              setForm(prev => ({ ...prev, phone_country: country, phone: national }))
              setFieldErrors(prev => ({ ...prev, phone: undefined }))
            }}
          />
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
            <ul className="pw-rules" aria-live="polite">
              {PASSWORD_RULES.map(r => (
                <li key={r} className={`pw-rules__item${pwChecks[r] ? ' pw-rules__item--ok' : ''}`}>
                  {pwChecks[r] ? <Check size={12} /> : <X size={12} />} {t(`reg.pw_${r}`)}
                </li>
              ))}
            </ul>
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
