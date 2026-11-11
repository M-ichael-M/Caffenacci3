import { useState, useCallback, useEffect } from 'react'
import { Leaf, Flame, Ban, X, Plus } from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'
import { useCafeSettings } from './CafeSettingsContext'
import { currencyExponent } from '../utils/currency'

// ── Types ────────────────────────────────────────────────────────────────────

interface MenuItemDraft {
  id: string          // local draft id
  name: string
  description: string
  price: string       // string for input control, parsed on save
  is_vege: boolean
  is_hot: boolean
  is_unavailable: boolean
}

interface MenuSectionDraft {
  id: string
  name: string
  items: MenuItemDraft[]
}

interface Props {
  token: string
  onClose: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2)
}

function emptyItem(): MenuItemDraft {
  return { id: uid(), name: '', description: '', price: '', is_vege: false, is_hot: false, is_unavailable: false }
}

function emptySection(): MenuSectionDraft {
  return { id: uid(), name: '', items: [emptyItem()] }
}

function serverToLocal(sections: ServerSection[]): MenuSectionDraft[] {
  return sections.map(s => ({
    id: uid(),
    name: s.name,
    items: s.items.map(it => ({
      id: uid(),
      name: it.name,
      description: it.description ?? '',
      price: String(it.price),
      is_vege: it.is_vege,
      is_hot: it.is_hot,
      is_unavailable: it.is_unavailable,
    })),
  }))
}

// ── Server types ─────────────────────────────────────────────────────────────

interface ServerItem {
  id: string
  name: string
  description?: string
  price: number
  position: number
  is_vege: boolean
  is_hot: boolean
  is_unavailable: boolean
}

interface ServerSection {
  id: string
  name: string
  position: number
  items: ServerItem[]
}

// ── Badge component ──────────────────────────────────────────────────────────

function Badge({ label, icon, active, onClick, color }: {
  label: string; icon: React.ReactNode; active: boolean; onClick: () => void; color: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        border: `1.5px solid ${active ? color : 'var(--border)'}`,
        background: active ? color : 'var(--surface)',
        color: active ? '#fff' : 'var(--text-muted)',
        borderRadius: '100px',
        padding: '3px 11px',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.05em',
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'inherit',
        lineHeight: '1.6',
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MenuEditor({ token, onClose }: Props) {
  const { t, tApi } = useI18n()
  const { currency } = useCafeSettings()
  const exp = currencyExponent(currency)
  const [sections, setSections] = useState<MenuSectionDraft[]>([emptySection()])
  const [loading, setLoading] = useState(false)
  const [fetchingMenu, setFetchingMenu] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)

  // Load existing menu on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/menu`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (data.sections && data.sections.length > 0) {
            setSections(serverToLocal(data.sections))
            setHasExisting(true)
          }
        }
      } catch {
        // network error – start fresh
      } finally {
        if (!cancelled) setFetchingMenu(false)
      }
    })()
    return () => { cancelled = true }
  }, [token])

  // ── Section mutations ────────────────────────────────────────────────

  const addSection = () => {
    setSections(prev => [...prev, emptySection()])
    setSaveSuccess(false)
  }

  const removeSection = (sid: string) => {
    setSections(prev => prev.filter(s => s.id !== sid))
    setSaveSuccess(false)
  }

  const updateSectionName = (sid: string, name: string) => {
    setSections(prev => prev.map(s => s.id === sid ? { ...s, name } : s))
    setSaveSuccess(false)
  }

  // ── Item mutations ───────────────────────────────────────────────────

  const addItem = (sid: string) => {
    setSections(prev => prev.map(s =>
      s.id === sid ? { ...s, items: [...s.items, emptyItem()] } : s
    ))
    setSaveSuccess(false)
  }

  const removeItem = (sid: string, iid: string) => {
    setSections(prev => prev.map(s =>
      s.id === sid ? { ...s, items: s.items.filter(it => it.id !== iid) } : s
    ))
    setSaveSuccess(false)
  }

  const updateItem = useCallback((sid: string, iid: string, patch: Partial<MenuItemDraft>) => {
    setSections(prev => prev.map(s =>
      s.id === sid
        ? { ...s, items: s.items.map(it => it.id === iid ? { ...it, ...patch } : it) }
        : s
    ))
    setSaveSuccess(false)
  }, [])

  // ── Save ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaveError(null)
    setSaveSuccess(false)

    // Basic validation
    for (const sec of sections) {
      if (!sec.name.trim()) {
        setSaveError(t('menuEditor.err.sectionName'))
        return
      }
      for (const it of sec.items) {
        if (!it.name.trim()) {
          setSaveError(t('menuEditor.err.itemName', { section: sec.name }))
          return
        }
        const price = parseFloat(it.price)
        if (isNaN(price) || price < 0) {
          setSaveError(t('menuEditor.err.price', { section: sec.name, item: it.name }))
          return
        }
      }
    }

    setLoading(true)
    try {
      const body = {
        sections: sections.map((s, si) => ({
          name: s.name.trim(),
          position: si,
          items: s.items.map((it, ii) => ({
            name: it.name.trim(),
            description: it.description.trim() || null,
            price: parseFloat(it.price),
            position: ii,
            is_vege: it.is_vege,
            is_hot: it.is_hot,
            is_unavailable: it.is_unavailable,
          })),
        })),
      }
      const res = await fetch(`${API_URL}/menu`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        setSaveError(tApi(err?.detail, 'menuEditor.err.save'))
        return
      }
      setHasExisting(true)
      setSaveSuccess(true)
    } catch {
      setSaveError(t('common.genericError'))
    } finally {
      setLoading(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────

  if (fetchingMenu) {
    return (
      <div className="menu-editor-overlay">
        <div className="menu-editor">
          <div className="loading-state">
            <div className="loading-spinner" />
            <p>{t('menuEditor.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="menu-editor-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="menu-editor">
        {/* Header */}
        <div className="me-header">
          <div>
            <div className="me-eyebrow">{t('menuEditor.eyebrow')}</div>
            <h2 className="me-title">{hasExisting ? t('menuEditor.titleEdit') : t('menuEditor.titleCreate')}</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label={t('menuEditor.close')}><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="me-body">
          {sections.map((sec, si) => (
            <div key={sec.id} className="me-section">
              {/* Section header */}
              <div className="me-section-header">
                <div className="me-section-header-left">
                  <span className="me-section-number">{String(si + 1).padStart(2, '0')}</span>
                  <input
                    className="me-section-name-input"
                    type="text"
                    value={sec.name}
                    onChange={e => updateSectionName(sec.id, e.target.value)}
                    placeholder={t('menuEditor.sectionPlaceholder')}
                    aria-label={t('menuEditor.sectionAria')}
                  />
                </div>
                {sections.length > 1 && (
                  <button
                    type="button"
                    className="me-remove-btn me-remove-section"
                    onClick={() => removeSection(sec.id)}
                    title={t('menuEditor.removeSection')}
                  >
                    {t('menuEditor.removeSection')}
                  </button>
                )}
              </div>

              {/* Items */}
              <div className="me-items">
                {sec.items.map((item) => (
                  <div key={item.id} className="me-item">
                    <div className="me-item-row me-item-row--main">
                      <div className="me-item-name-wrap">
                        <label className="me-label">{t('menuEditor.itemName')}</label>
                        <input
                          className="me-input"
                          type="text"
                          value={item.name}
                          onChange={e => updateItem(sec.id, item.id, { name: e.target.value })}
                          placeholder={t('menuEditor.itemNamePlaceholder')}
                        />
                      </div>
                      <div className="me-item-price-wrap">
                        <label className="me-label">{t('menuEditor.price', { currency })}</label>
                        <input
                          className="me-input me-input--price"
                          type="number"
                          min="0"
                          step={exp === 0 ? '1' : '0.01'}
                          value={item.price}
                          onChange={e => updateItem(sec.id, item.id, { price: e.target.value })}
                          placeholder={exp === 0 ? '0' : '0.00'}
                        />
                      </div>
                      <button
                        type="button"
                        className="me-remove-btn me-remove-item"
                        onClick={() => removeItem(sec.id, item.id)}
                        title={t('menuEditor.removeItem')}
                        disabled={sec.items.length === 1}
                      >
                        <X size={13} />
                      </button>
                    </div>

                    <div className="me-item-row">
                      <div style={{ flex: 1 }}>
                        <label className="me-label">{t('menuEditor.description')}</label>
                        <input
                          className="me-input"
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(sec.id, item.id, { description: e.target.value })}
                          placeholder={t('menuEditor.descriptionPlaceholder')}
                        />
                      </div>
                    </div>

                    <div className="me-item-badges">
                      <Badge
                        label={t('menu.badge.vege')}
                        icon={<Leaf size={12} />}
                        active={item.is_vege}
                        onClick={() => updateItem(sec.id, item.id, { is_vege: !item.is_vege })}
                        color="#2E7D32"
                      />
                      <Badge
                        label={t('menu.badge.hot')}
                        icon={<Flame size={12} />}
                        active={item.is_hot}
                        onClick={() => updateItem(sec.id, item.id, { is_hot: !item.is_hot })}
                        color="#B23B3B"
                      />
                      <Badge
                        label={t('menu.badge.unavailable')}
                        icon={<Ban size={12} />}
                        active={item.is_unavailable}
                        onClick={() => updateItem(sec.id, item.id, { is_unavailable: !item.is_unavailable })}
                        color="#8A7362"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="me-add-item-btn"
                  onClick={() => addItem(sec.id)}
                >
                  <Plus size={14} />
                  {t('menuEditor.addItem')}
                </button>
              </div>
            </div>
          ))}

          <button type="button" className="me-add-section-btn" onClick={addSection}>
            <Plus size={16} />
            {t('menuEditor.addSection')}
          </button>
        </div>

        {/* Footer */}
        <div className="me-footer">
          {saveError && <div className="form-error" role="alert">{saveError}</div>}
          {saveSuccess && <div className="form-success" role="status">{t('menuEditor.saved')}</div>}
          <div className="me-footer-actions">
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn--primary"
              style={{ width: 'auto', minWidth: '160px' }}
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? t('menuEditor.saving') : t('menuEditor.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
