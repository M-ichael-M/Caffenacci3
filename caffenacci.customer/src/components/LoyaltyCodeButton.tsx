import { useState, useEffect } from 'react'
import { QrCode, X } from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n/I18nProvider'

interface Props { token: string }

const API = API_URL

export default function LoyaltyCodeButton({ token }: Props) {
  const { t } = useI18n()
  const [code, setCode] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/loyalty/me`, { headers: { Authorization: `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          setCode(data.loyalty_code)
        }
      } catch { /* ignore */ }
      finally { setLoading(false) }
    })()
  }, [token])

  if (loading || !code) return null

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(code)}`

  return (
    <>
      <button
        type="button"
        className="btn btn--primary"
        style={{ width: '100%', padding: '0.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        onClick={() => setOpen(true)}
      >
        <QrCode size={17} />
        {t('loy.show_code')}
      </button>

      {open && (
        <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="menu-editor" style={{ maxWidth: 400, height: 'auto' }}>
            <div className="me-header">
              <div>
                <div className="me-eyebrow">{t('acc.loyalty_title')}</div>
                <h2 className="me-title">{t('loy.your_code')}</h2>
              </div>
              <button className="me-close" type="button" onClick={() => setOpen(false)} aria-label={t('acc.close')}><X size={16} /></button>
            </div>

            <div className="me-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('loy.show_staff')}</p>
              <img
                src={qrUrl}
                alt={t('loy.qr_alt')}
                width={220}
                height={220}
                style={{ borderRadius: 12, border: '1px solid var(--border)' }}
              />
              <div style={{
                fontFamily: 'monospace', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.15em',
                color: 'var(--text-dark)', background: 'var(--cream)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '0.75rem 1.25rem',
              }}>
                {code}
              </div>
            </div>

            <div className="me-footer">
              <button type="button" className="btn btn--outline-dark" onClick={() => setOpen(false)}>{t('acc.close')}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
