import { useState, useEffect, useCallback, useRef } from 'react'
import { Newspaper, X } from 'lucide-react'
import { API_URL } from '../config'
import { thumbUrl } from '../utils/imageUrl'
import { useI18n } from '../i18n'
import { useCafeSettings } from './CafeSettingsContext'
import { parseUtc } from '../utils/cafeTime'

interface NewsPostOut {
  id: string
  title: string
  content: string
  image_url: string | null
  created_at: string
}

interface NewsSettingsOut {
  id: string
  cafe_id: string
  enabled: boolean
}

interface Props {
  token: string
}

const API = API_URL
const MAX_NEWS_POSTS = 3

function Toggle({ checked, onChange, disabled = false }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      type="button" role="switch" aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? 'var(--espresso)' : 'var(--border)',
        opacity: disabled ? 0.5 : 1,
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: checked ? 'var(--gold-soft)' : '#fff',
        transition: 'left 0.2s, background 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

// ── Karta aktualności ──────────────────────────────────────────────────

function NewsCard({ post, onDelete, deleting }: {
  post: NewsPostOut
  onDelete: () => void
  deleting: boolean
}) {
  const { t, locale } = useI18n()
  const { timeZone } = useCafeSettings()
  const date = parseUtc(post.created_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone })
  return (
    <div className="nw-card">
      {post.image_url ? (
        <img
          src={thumbUrl(post.image_url, 480)}
          alt={post.title}
          className="nw-card__image"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="nw-card__image nw-card__image--fallback">
          <Newspaper size={38} strokeWidth={1.5} />
        </div>
      )}
      <div className="nw-card__body">
        <div className="nw-card__date">{date}</div>
        {/* Tytuł i treść wpisał właściciel — nie tłumaczymy ich automatycznie */}
        <div className="nw-card__title" translate="no">{post.title}</div>
        <div className="nw-card__excerpt" translate="no">{post.content}</div>
      </div>
      <button
        type="button"
        className="me-remove-btn me-remove-item"
        onClick={onDelete}
        disabled={deleting}
        title={t('news.delete.title')}
        aria-label={t('news.delete.title')}
        style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', background: 'rgba(255,255,255,0.92)' }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

// ── Formularz dodawania (slide-in panel) ─────────────────────────────────

function AddNewsPanel({ token, onClose, onAdded }: {
  token: string; onClose: () => void; onAdded: () => void
}) {
  const { t, tApi } = useI18n()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Zwalniamy blob URL podglądu, gdy się zmienia lub panel się zamyka.
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async () => {
    setError(null)
    if (!title.trim()) { setError(t('news.err.title')); return }
    if (!content.trim()) { setError(t('news.err.content')); return }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('title', title.trim())
      fd.append('content', content.trim())
      if (file) fd.append('file', file)

      const res = await fetch(`${API}/news`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const e = await res.json().catch(() => null)
        setError(tApi(e?.detail, 'news.err.save'))
        return
      }
      onAdded()
    } catch {
      setError(t('common.genericError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor">
        <div className="me-header">
          <div>
            <div className="me-eyebrow">{t('news.panel.eyebrow')}</div>
            <h2 className="me-title">{t('news.panel.title')}</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="me-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="field">
            <label className="me-label">{t('news.field.title')}</label>
            <input
              className="me-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('news.field.titlePlaceholder')}
              maxLength={200}
            />
          </div>

          <div className="field">
            <label className="me-label">{t('news.field.content')}</label>
            <textarea
              className="field__input"
              style={{ resize: 'vertical', minHeight: 140, lineHeight: 1.55 }}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={t('news.field.contentPlaceholder')}
              maxLength={5000}
            />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'right', display: 'block' }}>
              {content.length}/5000
            </span>
          </div>

          <div className="field">
            <label className="me-label">{t('news.field.image')}</label>
            {preview ? (
              <div style={{ position: 'relative', maxWidth: 320 }}>
                <img src={preview} alt={t('news.image.previewAlt')} style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
                <button
                  type="button"
                  className="me-remove-btn me-remove-item"
                  onClick={clearFile}
                  aria-label={t('common.close')}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,255,255,0.92)' }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="me-add-item-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                {t('news.image.add')}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem', display: 'block' }}>
              {t('news.image.hint')}
            </span>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="me-footer">
          <div className="me-footer-actions">
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>{t('common.cancel')}</button>
            <button
              type="button"
              className="btn btn--primary"
              style={{ width: 'auto', minWidth: 160 }}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? t('menuEditor.saving') : t('news.publish')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function NewsTab({ token }: Props) {
  const { t } = useI18n()
  const [settings, setSettings] = useState<NewsSettingsOut | null>(null)
  const [posts, setPosts] = useState<NewsPostOut[]>([])
  const [loading, setLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [settingsRes, postsRes] = await Promise.all([
        fetch(`${API}/news/settings`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/news`, { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (settingsRes.ok) setSettings(await settingsRes.json())
      if (postsRes.ok) {
        const data = await postsRes.json()
        setPosts(data.posts ?? [])
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleToggleEnabled = async (enabled: boolean) => {
    setSettingsSaving(true)
    try {
      const res = await fetch(`${API}/news/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled }),
      })
      if (res.ok) setSettings(await res.json())
    } catch { /* ignore */ }
    finally { setSettingsSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('news.delete.confirm'))) return
    setDeletingId(id)
    try {
      const res = await fetch(`${API}/news/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok || res.status === 204) {
        setPosts(prev => prev.filter(p => p.id !== id))
      }
    } catch { /* ignore */ }
    finally { setDeletingId(null) }
  }

  if (loading) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <p>{t('news.loading')}</p>
      </div>
    )
  }

  const canAddMore = posts.length < MAX_NEWS_POSTS

  return (
    <>
      {addOpen && (
        <AddNewsPanel
          token={token}
          onClose={() => setAddOpen(false)}
          onAdded={() => { setAddOpen(false); fetchAll() }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="page-header__eyebrow" style={{ marginBottom: '0.25rem' }}>
              {t('common.management')}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
              {t('news.title')}
            </h2>
          </div>
        </div>

        <div className="res-settings-block" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-dark)' }}>
                {t('news.toggle.title')}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                {t('news.toggle.hint', { max: MAX_NEWS_POSTS })}
              </div>
            </div>
            <Toggle
              checked={settings?.enabled ?? false}
              onChange={handleToggleEnabled}
              disabled={settingsSaving || !settings}
            />
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="res-empty-card">
            <div className="res-empty-icon">
              <Newspaper size={44} strokeWidth={1.4} />
            </div>
            <div className="res-empty-title">{t('news.empty.title')}</div>
            <div className="res-empty-sub">{t('news.empty.sub')}</div>
            <button
              className="btn btn--primary"
              style={{ width: 'auto', marginTop: '1rem' }}
              onClick={() => setAddOpen(true)}
            >
              {t('news.add')}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {t('news.counter', { count: posts.length, max: MAX_NEWS_POSTS })}
              </span>
              <button
                type="button"
                className="btn btn--primary"
                style={{ width: 'auto', padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
                onClick={() => setAddOpen(true)}
                disabled={!canAddMore}
                title={!canAddMore ? t('news.add.disabledTitle') : undefined}
              >
                {t('news.add')}
              </button>
            </div>
            <div className="nw-grid">
              {posts.map(p => (
                <NewsCard
                  key={p.id}
                  post={p}
                  onDelete={() => handleDelete(p.id)}
                  deleting={deletingId === p.id}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}