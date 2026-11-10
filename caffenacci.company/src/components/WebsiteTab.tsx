import { useState, useEffect, useCallback } from 'react'
import {
  Palette, SwatchBook, Link as LinkIcon, ExternalLink, Settings, Check, Coffee,
  LayoutDashboard, Sparkles, Clock, Flame, Crown, Factory, GlassWater, Rocket,
  Grid3X3, Wand2, Image as ImageIcon, Loader2, Eye, Lock,
} from 'lucide-react'
import { PALETTES } from '../palettes'
import { extractPaletteFromImageUrl } from '../utils/paletteFromImage'
import { API_URL, CUSTOMER_URL } from '../config'
import LanguagesCard from './LanguagesCard'
import { useI18n } from '../i18n'

interface Props {
  token: string
  cafeId: string
}

// Musi odpowiadać ALLOWED_TEMPLATES w backend/app/schemas/site.py
type SiteTemplate =
  | 'classic' | 'modern' | 'magic' | 'usa80s' | 'expressive'
  | 'premium' | 'industrial' | 'glass' | 'futuristic' | 'tiles'

const TEMPLATE_ICONS: Record<SiteTemplate, React.ReactNode> = {
  classic: <Coffee size={20} />,
  modern: <LayoutDashboard size={20} />,
  magic: <Sparkles size={20} />,
  usa80s: <Clock size={20} />,
  expressive: <Flame size={20} />,
  premium: <Crown size={20} />,
  industrial: <Factory size={20} />,
  glass: <GlassWater size={20} />,
  futuristic: <Rocket size={20} />,
  tiles: <Grid3X3 size={20} />,
}

// Etykiety i opisy: `website.tpl.<key>` oraz `website.tpl.<key>.desc`
const TEMPLATE_KEYS: SiteTemplate[] = [
  'classic', 'modern', 'magic', 'usa80s', 'expressive',
  'premium', 'industrial', 'glass', 'futuristic', 'tiles',
]

interface PublishInfo {
  slug: string | null
  is_published: boolean
  public_path: string | null
}

export default function WebsiteTab({ token, cafeId }: Props) {
  const { t, tApi } = useI18n()
  const [template, setTemplate] = useState<SiteTemplate>('classic')
  const [palette, setPalette]   = useState('espresso-gold')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saveMsg, setSaveMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [logoUrl, setLogoUrl]     = useState<string | null>(null)
  const [customPaletteVars, setCustomPaletteVars] = useState<Record<string, string> | null>(null)
  const [generatingPalette, setGeneratingPalette] = useState(false)
  const [paletteGenError, setPaletteGenError]     = useState<string | null>(null)

  const [publishInfo, setPublishInfo] = useState<PublishInfo | null>(null)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const [siteRes, profileRes, publishRes] = await Promise.all([
        fetch(`${API_URL}/site/settings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/profile`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/site/publish-status`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (siteRes.ok) {
        const data = await siteRes.json()
        setTemplate(data.template)
        setPalette(data.palette)
        setCustomPaletteVars(data.custom_palette ?? null)
      }
      if (profileRes.ok) {
        const p = await profileRes.json()
        setLogoUrl(p.logo_url ?? null)
      }
      if (publishRes.ok) {
        const pub = await publishRes.json()
        setPublishInfo({ slug: pub.slug, is_published: pub.is_published, public_path: pub.public_path })
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  const refreshPublishInfo = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/site/publish-status`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const pub = await res.json()
        setPublishInfo({ slug: pub.slug, is_published: pub.is_published, public_path: pub.public_path })
      }
    } catch { /* ignore */ }
  }, [token])

  useEffect(() => {
    window.addEventListener('caffenacci:profile-saved', refreshPublishInfo)
    return () => window.removeEventListener('caffenacci:profile-saved', refreshPublishInfo)
  }, [refreshPublishInfo])

  const handleGenerateFromLogo = async () => {
    if (!logoUrl) return
    setGeneratingPalette(true)
    setPaletteGenError(null)
    try {
      const vars = await extractPaletteFromImageUrl(`${API_URL}${logoUrl}`)
      setCustomPaletteVars(vars)
      setPalette('custom')
    } catch (err: unknown) {
      // paletteFromImage rzuca polskie komunikaty — tApi mapuje je na angielski
      setPaletteGenError(tApi(err instanceof Error ? err.message : null, 'website.err.palette'))
    } finally {
      setGeneratingPalette(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch(`${API_URL}/site/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          template,
          palette,
          custom_palette: palette === 'custom' ? customPaletteVars : null,
        }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => null)
        throw new Error(tApi(e?.detail, 'website.err.save'))
      }
      setSaveMsg({ type: 'ok', text: t('website.saved') })
    } catch (err: unknown) {
      setSaveMsg({ type: 'err', text: err instanceof Error ? err.message : t('website.err.save') })
    } finally { setSaving(false) }
  }

  const previewUrl = `${CUSTOMER_URL}/preview/${cafeId}?token=${encodeURIComponent(token)}`
  const liveUrl = publishInfo?.slug ? `${CUSTOMER_URL}/kawiarnia/${publishInfo.slug}` : null

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>{t('website.loading')}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <div className="page-header__eyebrow" style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={16} />
          {t('common.management')}
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
          {t('website.title')}
        </h2>
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: '70ch' }}>
        {t('website.intro')}
      </p>

      {saveMsg && (
        <div className={saveMsg.type === 'ok' ? 'form-success' : 'form-error'}>{saveMsg.text}</div>
      )}

      {/* Adres publiczny */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 'var(--radius-sm)',
        padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <LinkIcon size={16} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t('website.address')}</span>
        <code translate="no" style={{
          fontSize: '0.8rem', color: 'var(--gold)', background: 'rgba(169,114,47,0.08)',
          borderRadius: 4, padding: '2px 8px', wordBreak: 'break-all',
        }}>
          caffenacci.com{publishInfo?.public_path ?? ''}
        </code>
        {publishInfo?.is_published && liveUrl ? (
          <a href={liveUrl} target="_blank" rel="noreferrer" className="link"
            style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            {t('common.open')} <ExternalLink size={14} />
          </a>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Lock size={13} />
            {t('website.notPublished')}
          </span>
        )}
      </div>

      {/* Podgląd na żywo */}
      <div className="info-card">
        <div className="info-card__header">
          <span className="info-card__icon"><Eye size={20} /></span>
          <h2 className="info-card__title">{t('website.preview.title')}</h2>
        </div>
        <div className="info-card__body">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem' }}>
            {t('website.preview.text')}
          </p>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <iframe src={previewUrl} title={t('website.preview.iframe')} style={{ width: '100%', height: 720, border: 'none', display: 'block' }} />
          </div>
          <button
            type="button"
            className="btn btn--outline-dark"
            style={{ width: 'auto', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink size={16} />
            {t('website.preview.newTab')}
          </button>
        </div>
      </div>

      <LanguagesCard token={token} />

      {/* Wybór szablonu */}
      <div className="info-card">
        <div className="info-card__header">
          <span className="info-card__icon"><Palette size={20} /></span>
          <h2 className="info-card__title">{t('website.template.title')}</h2>
        </div>
        <div className="info-card__body">
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {TEMPLATE_KEYS.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setTemplate(key)}
                style={{
                  flex: '1 1 240px', textAlign: 'left', cursor: 'pointer',
                  border: `2px solid ${template === key ? 'var(--gold)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', padding: '1.25rem 1.125rem',
                  background: template === key ? 'rgba(169,114,47,0.06)' : 'var(--surface-2)',
                  fontFamily: 'inherit', position: 'relative', transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ color: template === key ? 'var(--gold)' : 'var(--text-muted)', transition: 'color 0.2s ease' }}>
                    {TEMPLATE_ICONS[key]}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '1.05rem' }}>
                    {t(`website.tpl.${key}`)}
                  </div>
                  {template === key && (
                    <Check size={18} strokeWidth={3} style={{ color: 'var(--gold)', marginLeft: 'auto' }} />
                  )}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {t(`website.tpl.${key}.desc`)}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Paleta z logo */}
      <div className="info-card">
        <div className="info-card__header">
          <span className="info-card__icon"><Wand2 size={20} /></span>
          <h2 className="info-card__title">{t('website.logoPalette.title')}</h2>
        </div>
        <div className="info-card__body">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem', lineHeight: 1.6 }}>
            {t('website.logoPalette.text')}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
              border: '2px solid var(--border)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)',
            }}>
              {logoUrl ? (
                <img src={`${API_URL}${logoUrl}`} alt={t('website.logoPalette.alt')}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <ImageIcon size={24} style={{ opacity: 0.35 }} />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn--primary"
                style={{ width: 'auto', marginTop: 0, padding: '0.625rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={handleGenerateFromLogo}
                disabled={!logoUrl || generatingPalette}
              >
                {generatingPalette ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 0.9s linear infinite' }} />
                    {t('website.logoPalette.generating')}
                  </>
                ) : (
                  <>
                    <Wand2 size={18} />
                    {customPaletteVars ? t('website.logoPalette.regenerate') : t('website.logoPalette.generate')}
                  </>
                )}
              </button>
              {!logoUrl && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {t('website.logoPalette.needLogo')}
                </span>
              )}
            </div>
          </div>

          {paletteGenError && <div className="form-error">{paletteGenError}</div>}

          {customPaletteVars && (
            <div style={{
              border: `2px solid ${palette === 'custom' ? 'var(--gold)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)', padding: '1rem 1.125rem',
              background: palette === 'custom' ? 'rgba(169,114,47,0.06)' : 'var(--surface-2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[customPaletteVars['--espresso'], customPaletteVars['--gold'], customPaletteVars['--parchment']].map((c, i) => (
                      <span key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.1)' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                    {t('website.logoPalette.yours')}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--outline-dark btn--sm"
                  style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  onClick={() => setPalette('custom')}
                >
                  {palette === 'custom' ? (<><Check size={15} /> {t('website.logoPalette.selected')}</>) : t('website.logoPalette.use')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Wybór palety kolorów */}
      <div className="info-card">
        <div className="info-card__header">
          <span className="info-card__icon"><SwatchBook size={20} /></span>
          <h2 className="info-card__title">{t('website.palette.title')}</h2>
        </div>
        <div className="info-card__body">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem' }}>
            {t('website.palette.text')}
          </p>
          <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap' }}>
            {PALETTES.map(p => {
              const label = t(`palette.${p.key}`)
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPalette(p.key)}
                  title={label}
                  style={{
                    cursor: 'pointer',
                    border: `2px solid ${palette === p.key ? 'var(--gold)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)', padding: '0.75rem',
                    background: 'var(--surface-2)', width: 140, fontFamily: 'inherit',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[p.vars['--espresso'], p.vars['--gold'], p.vars['--parchment']].map((c, i) => (
                      <span key={i} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.1)' }} />
                    ))}
                  </div>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dark)', textAlign: 'center',
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                  }}>
                    {label}
                    {palette === p.key && <Check size={15} strokeWidth={3} style={{ color: 'var(--gold)' }} />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn--primary"
          style={{ width: 'auto', minWidth: 200, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>{t('common.saving')}</>
          ) : (
            <>
              {t('website.save')} <Check size={17} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}