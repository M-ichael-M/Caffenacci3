import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard,
  Ticket,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Rocket,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

interface Props {
  token: string
  cafeId: string
}

const API = 'http://localhost:8000'

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

function formatDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function SubBadge({ status }: { status: SubStatus }) {
  if (status === 'active') {
    return (
      <span className="pf-badge pf-badge--public" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <CheckCircle2 size={13} />Aktywna
      </span>
    )
  }
  if (status === 'cancelling') {
    return (
      <span className="pf-badge pf-badge--warn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <Clock size={13} />Kończy się
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="pf-badge pf-badge--private" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
        <XCircle size={13} />Wygasła
      </span>
    )
  }
  return <span className="pf-badge pf-badge--private">Brak subskrypcji</span>
}

export default function BillingTab({ token, cafeId: _cafeId }: Props) {
  const [sub, setSub] = useState<SubscriptionStatusOut | null>(null)
  const [pub, setPub] = useState<PublishStatusOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [promoCode, setPromoCode] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [subRes, pubRes] = await Promise.all([
        fetch(`${API}/billing/status`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/site/publish-status`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (subRes.ok) setSub(await subRes.json())
      if (pubRes.ok) setPub(await pubRes.json())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function call(path: string, body?: object) {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Wystąpił błąd.')
      return data
    } finally {
      setBusy(false)
    }
  }

  const handleSubscribe = async () => {
    try {
      const data = await call('/billing/subscribe')
      setSub(data)
      setMsg({ type: 'ok', text: 'Subskrypcja została aktywowana (symulacja płatności).' })
      fetchAll()
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Błąd.' }) }
  }

  const handleCancel = async () => {
    if (!confirm('Anulować subskrypcję? Dostęp pozostanie aktywny do końca opłaconego okresu.')) return
    try {
      const data = await call('/billing/cancel')
      setSub(data)
      setMsg({ type: 'ok', text: 'Subskrypcja została anulowana — pozostanie aktywna do końca opłaconego okresu.' })
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Błąd.' }) }
  }

  const handleResume = async () => {
    try {
      const data = await call('/billing/resume')
      setSub(data)
      setMsg({ type: 'ok', text: 'Anulowanie zostało cofnięte — subskrypcja będzie się odnawiać.' })
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Błąd.' }) }
  }

  const handlePromo = async () => {
    if (!promoCode.trim()) return
    try {
      const data = await call('/billing/promo', { code: promoCode.trim() })
      setSub(data)
      setPromoCode('')
      setMsg({ type: 'ok', text: 'Kod promocyjny został aktywowany.' })
      fetchAll()
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Błąd.' }) }
  }

  const handlePublish = async () => {
    try {
      const data = await call('/site/publish')
      setPub(data)
      setMsg({ type: 'ok', text: 'Strona została opublikowana i jest teraz widoczna w wyszukiwarce Caffenacci.' })
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Błąd.' }) }
  }

  const handleUnpublish = async () => {
    if (!confirm('Wycofać publikację strony? Zniknie z wyszukiwarki, ale subskrypcja pozostanie aktywna.')) return
    try {
      const data = await call('/site/unpublish')
      setPub(data)
      setMsg({ type: 'ok', text: 'Publikacja strony została wycofana.' })
    } catch (e) { setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Błąd.' }) }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>Wczytywanie danych rozliczeniowych…</p>
      </div>
    )
  }

  const status = sub?.status ?? 'none'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="page-header__eyebrow">Zarządzanie</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
            Płatności i publikacja
          </h2>
        </div>
        <button className="btn btn--outline-dark" style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }} onClick={fetchAll}>
          <RefreshCw size={15} />
          Odśwież
        </button>
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '70ch' }}>
        Płatności są na razie w pełni symulowane — prawdziwa integracja (Stripe) zostanie podłączona później.
        Żadne rzeczywiste obciążenie karty nie następuje.
      </p>

      {msg && <div className={msg.type === 'ok' ? 'form-success' : 'form-error'}>{msg.text}</div>}

      {/* ── Subskrypcja ─────────────────────────────────────────────────── */}
      <div className="info-card">
        <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span className="info-card__icon"><CreditCard size={20} /></span>
            <h2 className="info-card__title">Subskrypcja</h2>
          </div>
          <SubBadge status={status} />
        </div>
        <div className="info-card__body">

          {status === 'none' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Nie masz jeszcze aktywnej subskrypcji. Aktywuj ją (symulacja), aby móc opublikować stronę kawiarni.
              </p>
              <button className="btn btn--primary" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleSubscribe} disabled={busy}>
                <Rocket size={17} />
                Aktywuj subskrypcję (symulacja)
              </button>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                <div className="me-label" style={{ marginBottom: '0.5rem' }}>Masz kod promocyjny?</div>
                <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                  <input
                    className="field__input" style={{ maxWidth: 220 }}
                    value={promoCode}
                    onChange={e => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="np. DEMO14"
                  />
                  <button className="btn btn--outline-dark" style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }} onClick={handlePromo} disabled={busy || !promoCode.trim()}>
                    <Ticket size={16} />
                    Aktywuj kod
                  </button>
                </div>
              </div>
            </>
          )}

          {(status === 'active' || status === 'cancelling') && (
            <>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <div className="info-row__label">{sub?.kind === 'promo' ? 'Kod promocyjny' : 'Rodzaj'}</div>
                  <div className="info-row__value">{sub?.kind === 'promo' ? sub?.promo_code : 'Subskrypcja miesięczna'}</div>
                </div>
                <div>
                  <div className="info-row__label">Aktywna od</div>
                  <div className="info-row__value">{formatDate(sub?.period_start ?? null)}</div>
                </div>
                <div>
                  <div className="info-row__label">
                    {sub?.kind === 'promo' ? 'Wygasa' : status === 'cancelling' ? 'Aktywna do' : 'Następne odnowienie'}
                  </div>
                  <div className="info-row__value">{formatDate(sub?.period_end ?? null)}</div>
                </div>
              </div>

              {status === 'cancelling' && (
                <div className="form-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} />
                  Subskrypcja jest anulowana i zakończy się {formatDate(sub?.period_end ?? null)}. Do tego czasu pozostaje aktywna.
                </div>
              )}

              {sub?.kind === 'subscription' && (
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {status === 'cancelling' ? (
                    <button className="btn btn--outline-dark" style={{ width: 'auto' }} onClick={handleResume} disabled={busy}>
                      Cofnij anulowanie
                    </button>
                  ) : (
                    <button
                      className="btn btn--outline-dark"
                      style={{ width: 'auto', color: 'var(--error)' }}
                      onClick={handleCancel}
                      disabled={busy || !sub?.can_cancel}
                      title={!sub?.can_cancel ? 'Za mało czasu do najbliższego odnowienia — spróbuj ponownie po tej dacie.' : undefined}
                    >
                      Anuluj subskrypcję
                    </button>
                  )}
                </div>
              )}
              {sub?.kind === 'promo' && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Kody promocyjne nie odnawiają się automatycznie — dostęp wygaśnie {formatDate(sub?.period_end ?? null)}.
                </p>
              )}
            </>
          )}

          {status === 'expired' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Twoja subskrypcja wygasła {formatDate(sub?.period_end ?? null)}. Aktywuj ją ponownie, aby móc publikować stronę.
              </p>
              <button className="btn btn--primary" style={{ width: 'auto' }} onClick={handleSubscribe} disabled={busy}>
                Wznów subskrypcję
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
            <h2 className="info-card__title">Publikacja strony</h2>
          </div>
          {pub?.is_published ? (
            <span className="pf-badge pf-badge--public" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <CheckCircle2 size={13} />Opublikowana
            </span>
          ) : (
            <span className="pf-badge pf-badge--private">Nieopublikowana</span>
          )}
        </div>
        <div className="info-card__body">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Dopóki strona nie zostanie opublikowana, nie jest dostępna publicznie, nie pojawia się w wyszukiwarce
            Caffenacci i nie będzie w przyszłości indeksowana przez Google. Możesz jednak w każdej chwili zobaczyć
            jej podgląd w zakładce „Strona WWW".
          </p>

          {pub?.slug && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Adres strony:</span>
              <code style={{ fontSize: '0.8rem', color: 'var(--gold)', background: 'rgba(169,114,47,0.08)', borderRadius: 4, padding: '2px 8px' }}>
                caffenacci.com{pub.public_path}
              </code>
              {pub.is_published && (
                <a href={`http://localhost:5174/cafe/${pub.slug}`} target="_blank" rel="noreferrer" className="link" style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  Otwórz <ExternalLink size={13} />
                </a>
              )}
            </div>
          )}

          {!pub?.can_publish && !pub?.is_published && pub && pub.missing_reasons.length > 0 && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1.125rem' }}>
              <div className="me-label" style={{ marginBottom: '0.5rem' }}>Aby opublikować, uzupełnij jeszcze:</div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {pub.missing_reasons.map((r, i) => (
                  <li key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-body)' }}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {pub?.is_published ? (
              <button className="btn btn--outline-dark" style={{ width: 'auto', color: 'var(--error)' }} onClick={handleUnpublish} disabled={busy}>
                Wycofaj publikację
              </button>
            ) : (
              <button
                className="btn btn--primary"
                style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={handlePublish}
                disabled={busy || !pub?.can_publish}
              >
                <Rocket size={17} />
                Opublikuj stronę
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}