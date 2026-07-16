import { useState, useEffect, useCallback, useRef } from 'react'

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

const API = 'http://localhost:8000'
const MAX_NEWS_POSTS = 3

function formatDate(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
}

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
        background: checked ? 'var(--gold)' : '#fff',
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
  return (
    <div className="nw-card">
      {post.image_url ? (
        <img src={`${API}${post.image_url}`} alt={post.title} className="nw-card__image" />
      ) : (
        <div className="nw-card__image nw-card__image--fallback">📰</div>
      )}
      <div className="nw-card__body">
        <div className="nw-card__date">{formatDate(post.created_at)}</div>
        <div className="nw-card__title">{post.title}</div>
        <div className="nw-card__excerpt">{post.content}</div>
      </div>
      <button
        type="button"
        className="me-remove-btn me-remove-item"
        onClick={onDelete}
        disabled={deleting}
        title="Usuń aktualność"
        style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', background: 'rgba(255,255,255,0.92)' }}
      >✕</button>
    </div>
  )
}

// ── Formularz dodawania (slide-in panel) ─────────────────────────────────

function AddNewsPanel({ token, onClose, onAdded }: {
  token: string; onClose: () => void; onAdded: () => void
}) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    if (!title.trim()) { setError('Podaj tytuł aktualności.'); return }
    if (!content.trim()) { setError('Dodaj treść aktualności.'); return }

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
        const e = await res.json()
        throw new Error(e.detail || 'Błąd zapisu aktualności.')
      }
      onAdded()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd. Spróbuj ponownie.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor">
        <div className="me-header">
          <div>
            <div className="me-eyebrow">Aktualności</div>
            <h2 className="me-title">Nowa aktualność</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>

        <div className="me-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="field">
            <label className="me-label">Tytuł</label>
            <input
              className="me-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="np. Nowe godziny otwarcia od poniedziałku"
              maxLength={200}
            />
          </div>

          <div className="field">
            <label className="me-label">Treść</label>
            <textarea
              className="field__input"
              style={{ resize: 'vertical', minHeight: 140, lineHeight: 1.55 }}
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Opisz szczegóły aktualności…"
              maxLength={5000}
            />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textAlign: 'right', display: 'block' }}>
              {content.length}/5000
            </span>
          </div>

          <div className="field">
            <label className="me-label">Grafika (opcjonalnie)</label>
            {preview ? (
              <div style={{ position: 'relative', maxWidth: 320 }}>
                <img src={preview} alt="Podgląd" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
                <button
                  type="button"
                  className="me-remove-btn me-remove-item"
                  onClick={clearFile}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,255,255,0.92)' }}
                >✕</button>
              </div>
            ) : (
              <button
                type="button"
                className="me-add-item-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                + Dodaj grafikę
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
              Max 10 MB (PNG, JPEG, WEBP).
            </span>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="me-footer">
          <div className="me-footer-actions">
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>Anuluj</button>
            <button
              type="button"
              className="btn btn--primary"
              style={{ width: 'auto', minWidth: 160 }}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? 'Zapisywanie…' : 'Opublikuj aktualność'}
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
    if (!confirm('Czy na pewno chcesz usunąć tę aktualność?')) return
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
        <p>Wczytywanie aktualności…</p>
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
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: '0.25rem' }}>
              Zarządzanie
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
              Aktualności
            </h2>
          </div>
        </div>

        <div className="res-settings-block" style={{ margin: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-dark)' }}>
                Pokazuj sekcję aktualności na stronie
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                Możesz mieć maksymalnie {MAX_NEWS_POSTS} aktualności widoczne jednocześnie.
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
            <div className="res-empty-icon">📰</div>
            <div className="res-empty-title">Brak aktualności</div>
            <div className="res-empty-sub">
              Dodaj pierwszą aktualność, aby poinformować gości o nowościach, wydarzeniach lub zmianach.
            </div>
            <button
              className="btn btn--primary"
              style={{ width: 'auto', marginTop: '1rem' }}
              onClick={() => setAddOpen(true)}
            >
              + Dodaj aktualność
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {posts.length} / {MAX_NEWS_POSTS} aktualności
              </span>
              <button
                type="button"
                className="btn btn--primary"
                style={{ width: 'auto', padding: '0.625rem 1.25rem', fontSize: '0.875rem' }}
                onClick={() => setAddOpen(true)}
                disabled={!canAddMore}
                title={!canAddMore ? 'Usuń jedną aktualność, aby dodać nową.' : undefined}
              >
                + Dodaj aktualność
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