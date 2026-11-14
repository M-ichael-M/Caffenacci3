import { useEffect, useMemo, useState } from 'react'
import { Globe } from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'
import { formatMoney } from '../utils/currency'
import { SearchableSelect, timeZones } from './LanguagesCard'

interface Props { token: string }

export default function RegionCard({ token }: Props) {
  const { t, tApi, locale } = useI18n()
  const [currencies, setCurrencies] = useState<string[]>([])
  const [saved, setSaved] = useState<{ currency: string; time_zone: string; confirmed: boolean } | null>(null)
  const [currency, setCurrency] = useState('PLN')
  const [timeZone, setTimeZone] = useState('Europe/Warsaw')
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const zones = useMemo(timeZones, [])
  const auth = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    (async () => {
      try {
        const [o, r] = await Promise.all([
          fetch(`${API_URL}/i18n/options`, { headers: auth }),
          fetch(`${API_URL}/i18n/region`, { headers: auth }),
        ])
        if (!o.ok || !r.ok) throw new Error()
        setCurrencies((await o.json()).currencies)
        const reg = await r.json()
        setSaved(reg); setCurrency(reg.currency); setTimeZone(reg.time_zone)
      } catch { setFailed(true) }
      finally { setLoading(false) }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const currencyChanged = !!saved && saved.currency !== currency
  const dirty = !!saved && (currencyChanged || saved.time_zone !== timeZone)
  const unconfirmed = !!saved && !saved.confirmed
  const canSave = unconfirmed || dirty

  const handleSave = async () => {
    if (currencyChanged && !confirm(t('profile.region.confirmCurrency', { from: saved!.currency, to: currency }))) return
    setSaving(true); setMsg(null)
    try {
      const res = await fetch(`${API_URL}/i18n/region`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ currency, time_zone: timeZone }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const d = data?.detail
        const text = Array.isArray(d)
          ? d.map((x: { msg?: string }) => String(x.msg ?? '').replace(/^Value error, /, '')).join(' ')
          : d
        throw new Error(tApi(text, 'profile.region.err.save'))
      }
      setSaved(data)
      setMsg({ type: 'ok', text: t('profile.region.saved') })
      window.dispatchEvent(new Event('caffenacci:profile-saved'))   // CafeSettingsContext, LanguagesCard, BillingTab
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t('common.genericError') })
    } finally { setSaving(false) }
  }

  if (loading) return null
  if (failed) return <div className="form-error" role="alert">{t('profile.region.err.load')}</div>

  const now = new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone })
  return (
    <div className="info-card" style={{ gridColumn: '1 / -1' }}>
      <div className="info-card__header">
        <span className="info-card__icon"><Globe size={20} /></span>
        <h2 className="info-card__title" style={{ textTransform: 'none', fontSize: '0.9375rem' }}>{t('profile.region.title')}</h2>
      </div>
      <div className="info-card__body">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem', lineHeight: 1.6 }}>
          {t('profile.region.intro')}
        </p>

        {msg && <div className={msg.type === 'ok' ? 'form-success' : 'form-error'}>{msg.text}</div>}

        <div className="language-picker-grid">
          <SearchableSelect label={t('languages.currency')} value={currency} onChange={setCurrency}
            placeholder={t('languages.searchCurrency')} options={currencies.map(c => ({ value: c, label: c }))} />
          <SearchableSelect label={t('languages.timeZone')} value={timeZone} onChange={setTimeZone}
            placeholder={t('languages.searchTimeZone')}
            options={[...new Set([timeZone, ...zones])].map(z => ({ value: z, label: z, searchText: z.replaceAll('_', ' ') }))} />
        </div>

        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {t('profile.region.preview')}: {formatMoney(1234.5, locale, currency)} · {now}
        </div>

        {currencyChanged && (
          <div className="form-error" role="status">{t('profile.region.warn')}</div>
        )}

        {unconfirmed && <div className="form-error" role="status">{t('profile.region.unconfirmed')}</div>}

        <div>
          <button type="button" className="btn btn--primary" style={{ width: 'auto', marginTop: 0 }}
            onClick={handleSave} disabled={saving || !canSave}>
            {saving ? t('common.saving') : unconfirmed && !dirty ? t('profile.region.confirm') : t('profile.region.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
