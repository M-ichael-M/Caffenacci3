import { useState } from 'react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'
import { browserTimeZone, detectCountryName } from '../utils/regionDefaults'

const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(' ')

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
  country: '',
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
  const { t, tApi, lang } = useI18n()
  const [form, setForm] = useState<FormData>(() => ({ ...INITIAL, country: detectCountryName() }))
  const timeZone = browserTimeZone()
  const countryNames = new Intl.DisplayNames([lang === 'pl' ? 'pl' : 'en'], { type: 'region' })
  const polishCountryNames = new Intl.DisplayNames(['pl'], { type: 'region' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => ({ ...prev, [key]: undefined }))
  }

  // Błędy trzymamy jako klucze tłumaczeń, a tłumaczymy dopiero przy renderze —
  // dzięki temu zmiana języka od razu zmienia też widoczne błędy.
  const validate = (): boolean => {
    const e: FieldErrors = {}
    if (!form.owner_name.trim())         e.owner_name       = 'register.err.ownerName'
    if (!form.cafe_name.trim())          e.cafe_name        = 'register.err.cafeName'
    if (!isValidEmail(form.email))       e.email            = 'register.err.email'
    if (!form.phone.trim())              e.phone            = 'register.err.phone'
    if (form.password.length < 8)        e.password         = 'register.err.password'
    if (!form.street.trim())             e.street           = 'register.err.street'
    if (!form.building_number.trim())    e.building_number  = 'register.err.number'
    if (!form.postal_code.trim())        e.postal_code      = 'register.err.postalCode'
    if (!form.city.trim())               e.city             = 'register.err.city'
    if (!form.country.trim())            e.country          = 'register.err.country'
    if (!form.terms)                     e.terms            = 'register.err.terms'
    setFieldErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!validate()) return
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_name: form.owner_name,
          cafe_name: form.cafe_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          address: {
            country: form.country.trim(),
            city: form.city,
            street: form.street,
            building_number: form.building_number,
            postal_code: form.postal_code,
          },
          time_zone: timeZone || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(tApi(data.detail, 'register.err.generic'))
        return
      }
      onSuccess()
    } catch {
      setError(t('common.genericError'))
    } finally {
      setLoading(false)
    }
  }

  const fe = fieldErrors
  const err = (k: keyof FormData) => fe[k] && <span className="field__error">{t(fe[k]!)}</span>

  return (
    <div className="form-wrapper">
      <div className="form-header">
        <h2 className="form-title">{t('register.title')}</h2>
        <p className="form-subtitle">{t('register.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="form" noValidate>

        {/* ── Właściciel ── */}
        <div className="form-section">
          <span className="form-section__label">{t('register.section.owner')}</span>

          <div className="field">
            <label className="field__label" htmlFor="reg-owner_name">{t('register.ownerName')}</label>
            <input
              id="reg-owner_name"
              type="text"
              className={`field__input${fe.owner_name ? ' field__input--error' : ''}`}
              value={form.owner_name}
              onChange={e => set('owner_name', e.target.value)}
              placeholder={t('register.ownerNamePlaceholder')}
              autoComplete="name"
            />
            {err('owner_name')}
          </div>

          <div className="field-row">
            <div className="field field--grow">
              <label className="field__label" htmlFor="reg-email">{t('register.email')}</label>
              <input
                id="reg-email"
                type="email"
                className={`field__input${fe.email ? ' field__input--error' : ''}`}
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder={t('register.emailPlaceholder')}
                autoComplete="email"
              />
              {err('email')}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="reg-phone">{t('register.phone')}</label>
              <input
                id="reg-phone"
                type="tel"
                className={`field__input${fe.phone ? ' field__input--error' : ''}`}
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+48 123 456 789"
                autoComplete="tel"
              />
              {err('phone')}
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="reg-password">{t('register.password')}</label>
            <input
              id="reg-password"
              type="password"
              className={`field__input${fe.password ? ' field__input--error' : ''}`}
              value={form.password}
              onChange={e => set('password', e.target.value)}
              placeholder={t('register.passwordPlaceholder')}
              autoComplete="new-password"
            />
            {err('password')}
          </div>
        </div>

        {/* ── Kawiarnia ── */}
        <div className="form-section">
          <span className="form-section__label">{t('register.section.cafe')}</span>

          <div className="field">
            <label className="field__label" htmlFor="reg-cafe_name">{t('register.cafeName')}</label>
            <input
              id="reg-cafe_name"
              type="text"
              className={`field__input${fe.cafe_name ? ' field__input--error' : ''}`}
              value={form.cafe_name}
              onChange={e => set('cafe_name', e.target.value)}
              placeholder={t('register.cafeNamePlaceholder')}
            />
            {err('cafe_name')}
          </div>
        </div>

        {/* ── Adres ── */}
        <div className="form-section">
          <span className="form-section__label">{t('register.section.address')}</span>

          <div className="field-row">
            <div className="field field--grow">
              <label className="field__label" htmlFor="reg-street">{t('register.street')}</label>
              <input
                id="reg-street"
                type="text"
                className={`field__input${fe.street ? ' field__input--error' : ''}`}
                value={form.street}
                onChange={e => set('street', e.target.value)}
                placeholder="Marszałkowska"
                autoComplete="street-address"
              />
              {err('street')}
            </div>

            <div className="field field--small">
              <label className="field__label" htmlFor="reg-building_number">{t('register.number')}</label>
              <input
                id="reg-building_number"
                type="text"
                className={`field__input${fe.building_number ? ' field__input--error' : ''}`}
                value={form.building_number}
                onChange={e => set('building_number', e.target.value)}
                placeholder="12A"
              />
              {err('building_number')}
            </div>
          </div>

          <div className="field-row">
            <div className="field field--small">
              <label className="field__label" htmlFor="reg-postal_code">{t('register.postalCode')}</label>
              <input
                id="reg-postal_code"
                type="text"
                className={`field__input${fe.postal_code ? ' field__input--error' : ''}`}
                value={form.postal_code}
                onChange={e => set('postal_code', e.target.value)}
                placeholder="00-001"
                autoComplete="postal-code"
              />
              {err('postal_code')}
            </div>

            <div className="field field--grow">
              <label className="field__label" htmlFor="reg-city">{t('register.city')}</label>
              <input
                id="reg-city"
                type="text"
                className={`field__input${fe.city ? ' field__input--error' : ''}`}
                value={form.city}
                onChange={e => set('city', e.target.value)}
                placeholder="Warszawa"
                autoComplete="address-level2"
              />
              {err('city')}
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="reg-country">{t('register.country')}</label>
            <select
              id="reg-country"
              className={`field__input${fe.country ? ' field__input--error' : ''}`}
              value={form.country}
              onChange={e => set('country', e.target.value)}
              autoComplete="country-name"
            >
              <option value="">{lang === 'pl' ? 'Wybierz kraj' : 'Select a country'}</option>
              {COUNTRY_CODES.map(code => {
                const value = polishCountryNames.of(code) ?? code
                return <option key={code} value={value}>{countryNames.of(code) ?? value}</option>
              })}
            </select>
            {err('country')}
            {timeZone && (
              <span className="field__hint" translate="no">
                {t('register.timeZoneHint', { tz: timeZone })}
              </span>
            )}
          </div>
        </div>

        {/* ── Zgody ── */}
        <div className="form-section">
          <span className="form-section__label">{t('register.section.consents')}</span>

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
                {t('register.terms.prefix')}{' '}
                <a href="/regulamin" className="link" onClick={e => e.preventDefault()}>
                  {t('register.terms.link')}
                </a>
                {' '}<span className="required-mark">*</span>
              </label>
            </div>
            {fe.terms && <p className="checkbox-error">{t(fe.terms)}</p>}
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
              {t('register.marketing.prefix')}{' '}
              <a href="/zgoda-marketingowa" className="link" onClick={e => e.preventDefault()}>
                {t('register.marketing.link')}
              </a>
            </label>
          </div>
        </div>

        {error && (
          <div className="form-error" role="alert">{error}</div>
        )}

        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? t('register.submitting') : t('register.submit')}
        </button>

        <p className="form-note">
          {t('register.note.before')} <span className="required-mark">*</span> {t('register.note.after')}
        </p>
      </form>

      <div className="form-switch">
        <p>
          {t('register.haveAccount')}{' '}
          <button type="button" className="link-btn" onClick={onSwitchToLogin}>
            {t('register.loginLink')}
          </button>
        </p>
      </div>
    </div>
  )
}
