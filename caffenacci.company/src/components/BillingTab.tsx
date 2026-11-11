import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard, Ticket, CheckCircle2, XCircle, Clock, Globe, Rocket,
  AlertTriangle, RefreshCw, ExternalLink, Users,
} from 'lucide-react'
import { API_URL, CUSTOMER_URL } from '../config'
import { useI18n } from '../i18n'
import { parseUtc } from '../utils/cafeTime'

interface Props {
  token: string
  cafeId: string
}

const API = API_URL

type SubStatus = 'none' | 'active' | 'cancelling' | 'expired'

interface SubscriptionStatusOut {
  kind: string | null
  status: SubStatus
  period_start: string | null
  period_end: string | null
  cancel_at_period_end: boolean
  promo_code: string | null
  can_cancel: boolean
  next_billing_date: string | null
}

interface PublishStatusOut {
  is_published: boolean
  can_publish: boolean
  missing_reasons: string[]
  slug: string | null
  public_path: string | null
  published_at: string | null
}

function formatDate(s: string | null, locale: string) {
  if (!s) return '—'
  return parseUtc(s).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

function SubBadge({ status }: { status: SubStatus }) {
  const { t } = useI18n()
  if (status === 'active') {
    return (
      <span className="pf-badge pf-badge--public" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <CheckCircle2 size={13} />{t('billing.badge.active')}
      </span>
    )
  }
  if (status === 'cancelling') {
    return (
      <span className="pf-badge pf-badge--warn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <Clock size={13} />{t('billing.badge.cancelling')}
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="pf-badge pf-badge--private" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <XCircle size={13} />{t('billing.badge.expired')}
      </span>
    )
  }
  return <span className="pf-badge pf-badge--private">{t('billing.badge.none')}</span>
}

export default function BillingTab({ token, cafeId: _cafeId }: Props) {
  const { t, tApi, locale } = useI18n()
  const [sub, setSub] = useState<SubscriptionStatusOut | null>(null)
  const [pub, setPub] = useState<PublishStatusOut | null>(null)
  const [staffCode, setStaffCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [promoCode, setPromoCode] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [subRes, pubRes, staffRes] = await Promise.all([
        fetch(`${API}/billing/status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/site/publish-status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/billing/staff-code`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (subRes.ok) setSub(await subRes.json())
      if (pubRes.ok) setPub(await pubRes.json())
      if (staffRes.ok) setStaffCode((await staffRes.json()).staff_code)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    window.addEventListener('caffenacci:profile-saved', fetchAll)
    return () => window.removeEventListener('caffenacci:profile-saved', fetchAll)
  }, [fetchAll])

  async function call(path: string, body?: object) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(tApi(data?.detail))
      return data
    } finally {
      setBusy(false)
    }
  }

  const errText = (e: unknown) => (e instanceof Error ? e.message : t('common.genericError'))

  const handleSubscribe = async () => {
    try {
      const data = await call('/billing/subscribe')
      setSub(data)
      setMsg({ type: 'ok', text: t('billing.msg.subscribed') })
      fetchAll()
    } catch (e) { setMsg({ type: 'err', text: errText(e) }) }
  }

  const handleCancel = async () => {
    if (!confirm(t('billing.confirm.cancel'))) return
    try {
      const data = await call('/billing/cancel')
      setSub(data)
      setMsg({ type: 'ok', text: t('billing.msg.cancelled') })
    } catch (e) { setMsg({ type: 'err', text: errText(e) }) }
  }

  const handleResume = async () => {
    try {
      const data = await call('/billing/resume')
      setSub(data)
      setMsg({ type: 'ok', text: t('billing.msg.resumed') })
    } catch (e) { setMsg({ type: 'err', text: errText(e) }) }
  }

  const handlePromo = async () => {
    if (!promoCode.trim()) return
    try {
      const data = await call('/billing/promo', { code: promoCode.trim() })
      setSub(data)
      setPromoCode('')
      setMsg({ type: 'ok', text: t('billing.msg.promo') })
      fetchAll()
    } catch (e) { setMsg({ type: 'err', text: errText(e) }) }
  }

  const handlePublish = async () => {
    try {
      const data = await call('/site/publish')
      setPub(data)
      setMsg({ type: 'ok', text: t('billing.msg.published') })
    } catch (e) { setMsg({ type: 'err', text: errText(e) }) }
  }

  const handleUnpublish = async () => {
    if (!confirm(t('billing.confirm.unpublish'))) return
    try {
      const data = await call('/site/unpublish')
      setPub(data)
      setMsg({ type: 'ok', text: t('billing.msg.unpublished') })
    } catch (e) { setMsg({ type: 'err', text: errText(e) }) }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>{t('billing.loading')}</p>
      </div>
    )
  }

  const status = sub?.status ?? 'none'
  const periodEnd = formatDate(sub?.period_end ?? null, locale)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="page-header__eyebrow">{t('common.management')}</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
            {t('billing.title')}
          </h2>
        </div>
        <button className="btn btn--outline-dark" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={fetchAll}>
          <RefreshCw size={15} />
          {t('common.refresh')}
        </button>
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '70ch' }}>
        {t('billing.simulatedNote')}
      </p>

      {msg && <div className={msg.type === 'ok' ? 'form-success' : 'form-error'}>{msg.text}</div>}

      {/* ── Subskrypcja ─────────────────────────────────────────────────── */}
      <div className="info-card">
        <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span className="info-card__icon"><CreditCard size={20} /></span>
            <h2 className="info-card__title">{t('billing.sub.title')}</h2>
          </div>
          <SubBadge status={status} />
        </div>
        <div className="info-card__body">

          {status === 'none' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {t('billing.sub.noneText')}
              </p>
              <button className="btn btn--primary" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleSubscribe} disabled={busy}>
                <Rocket size={17} />
                {t('billing.sub.activate')}
              </button>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <div className="me-label" style={{ marginBottom: '0.5rem' }}>{t('billing.promo.question')}</div>
                <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <input
                    className="field__input" style={{ maxWidth: 220 }}
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    placeholder={t('billing.promo.placeholder')}
                  />
                  <button className="btn btn--outline-dark" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }} onClick={handlePromo} disabled={busy || !promoCode.trim()}>
                    <Ticket size={16} />
                    {t('billing.promo.activate')}
                  </button>
                </div>
              </div>
            </>
          )}

          {(status === 'active' || status === 'cancelling') && (
            <>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <div className="info-row__label">{sub?.kind === 'promo' ? t('billing.label.promoCode') : t('billing.label.kind')}</div>
                  <div className="info-row__value">{sub?.kind === 'promo' ? sub?.promo_code : t('billing.kind.monthly')}</div>
                </div>
                <div>
                  <div className="info-row__label">{t('billing.label.activeSince')}</div>
                  <div className="info-row__value">{formatDate(sub?.period_start ?? null, locale)}</div>
                </div>
                <div>
                  <div className="info-row__label">
                    {sub?.kind === 'promo'
                      ? t('billing.label.expires')
                      : status === 'cancelling'
                        ? t('billing.label.activeUntil')
                        : t('billing.label.nextRenewal')}
                  </div>
                  <div className="info-row__value">{periodEnd}</div>
                </div>
              </div>

              {status === 'cancelling' && (
                <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} />
                  {t('billing.cancellingNotice', { date: periodEnd })}
                </div>
              )}

              {sub?.kind === 'subscription' && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {status === 'cancelling' ? (
                    <button className="btn btn--outline-dark" style={{ width: 'auto' }} onClick={handleResume} disabled={busy}>
                      {t('billing.resume')}
                    </button>
                  ) : (
                    <button
                      className="btn btn--outline-dark"
                      style={{ width: 'auto', color: 'var(--error)' }}
                      onClick={handleCancel}
                      disabled={busy || !sub?.can_cancel}
                      title={!sub?.can_cancel ? t('billing.cancel.tooSoon') : undefined}
                    >
                      {t('billing.cancel')}
                    </button>
                  )}
                </div>
              )}
              {sub?.kind === 'promo' && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {t('billing.promo.noRenew', { date: periodEnd })}
                </p>
              )}
            </>
          )}

          {status === 'expired' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {t('billing.expired.text', { date: periodEnd })}
              </p>
              <button className="btn btn--primary" style={{ width: 'auto' }} onClick={handleSubscribe} disabled={busy}>
                {t('billing.resumeSub')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Publikacja ──────────────────────────────────────────────────── */}
      <div className="info-card">
        <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span className="info-card__icon"><Globe size={20} /></span>
            <h2 className="info-card__title">{t('billing.pub.title')}</h2>
          </div>
          {pub?.is_published ? (
            <span className="pf-badge pf-badge--public" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <CheckCircle2 size={13} />{t('billing.pub.badge.published')}
            </span>
          ) : (
            <span className="pf-badge pf-badge--private">{t('billing.pub.badge.unpublished')}</span>
          )}
        </div>
        <div className="info-card__body">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {t('billing.pub.text')}
          </p>

          {pub?.slug && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t('billing.pub.address')}</span>
              <code translate="no" style={{ fontSize: '0.8rem', color: 'var(--gold)', background: 'rgba(169,114,47,0.08)', borderRadius: 4, padding: '2px 8px' }}>
                caffenacci.com{pub.public_path}
              </code>
              {pub.is_published && (
                <a href={`${CUSTOMER_URL}/kawiarnia/${pub.slug}`} target="_blank" rel="noreferrer" className="link" style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  {t('common.open')} <ExternalLink size={13} />
                </a>
              )}
            </div>
          )}

          {!pub?.can_publish && !pub?.is_published && pub && pub.missing_reasons.length > 0 && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1.125rem' }}>
              <div className="me-label" style={{ marginBottom: '0.5rem' }}>{t('billing.pub.missing')}</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {pub.missing_reasons.map((r, i) => (
                  <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-body)' }}>{tApi(r)}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {pub?.is_published ? (
              <button className="btn btn--outline-dark" style={{ width: 'auto', color: 'var(--error)' }} onClick={handleUnpublish} disabled={busy}>
                {t('billing.pub.unpublish')}
              </button>
            ) : (
              <button
                className="btn btn--primary"
                style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={handlePublish}
                disabled={busy || !pub?.can_publish}
              >
                <Rocket size={17} />
                {t('billing.pub.publish')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Kod kawiarni dla pracowników ────────────────────────────────── */}
      <div className="info-card">
        <div className="info-card__header">
          <span className="info-card__icon"><Users size={20} /></span>
          <h2 className="info-card__title">{t('billing.staff.title')}</h2>
        </div>
        <div className="info-card__body">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {t('billing.staff.text')}
          </p>
          <code translate="no" style={{
            fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.15em',
            color: 'var(--gold)', background: 'rgba(169,114,47,0.08)',
            borderRadius: 6, padding: '0.5rem 1rem', display: 'inline-block',
          }}>
            {staffCode ?? '········'}
          </code>
        </div>
      </div>
    </div>
  )
}