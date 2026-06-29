import { useState, useCallback } from 'react'

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

function Badge({ label, active, onClick, color }: {
  label: string; active: boolean; onClick: () => void; color: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        appearance: 'none',
        border: `1.5px solid ${active ? color : 'var(--border)'}`,
        background: active ? color : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        borderRadius: '100px',
        padding: '2px 10px',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.07em',
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontFamily: 'inherit',
        lineHeight: '1.6',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MenuEditor({ token, onClose }: Props) {
  const [sections, setSections] = useState<MenuSectionDraft[]>([emptySection()])
  const [loading, setLoading] = useState(false)
  const [fetchingMenu, setFetchingMenu] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [hasExisting, setHasExisting] = useState(false)

  // Load existing menu on mount
  useState(() => {
    ;(async () => {
      try {
        const res = await fetch('http://localhost:8000/menu', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.sections && data.sections.length > 0) {
            setSections(serverToLocal(data.sections))
            setHasExisting(true)
          }
        }
      } catch {
        // network error – start fresh
      } finally {
        setFetchingMenu(false)
      }
    })()
  })

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
        setSaveError('Każda sekcja musi mieć nazwę.')
        return
      }
      for (const it of sec.items) {
        if (!it.name.trim()) {
          setSaveError(`W sekcji „${sec.name}" brakuje nazwy przy jednej z pozycji.`)
          return
        }
        const price = parseFloat(it.price)
        if (isNaN(price) || price < 0) {
          setSaveError(`W sekcji „${sec.name}" cena pozycji „${it.name}" jest nieprawidłowa.`)
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
      const res = await fetch('http://localhost:8000/menu', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Błąd zapisu menu.')
      }
      setHasExisting(true)
      setSaveSuccess(true)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Wystąpił błąd. Spróbuj ponownie.')
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
            <p>Wczytywanie menu…</p>
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
            <div className="me-eyebrow">Kreator menu</div>
            <h2 className="me-title">{hasExisting ? 'Edytuj menu' : 'Utwórz menu'}</h2>
          </div>
          <button className="me-close" type="button" onClick={onClose} aria-label="Zamknij">✕</button>
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
                    placeholder="np. KAWY, HERBATY, DESERY…"
                    aria-label="Nazwa sekcji"
                  />
                </div>
                {sections.length > 1 && (
                  <button
                    type="button"
                    className="me-remove-btn me-remove-section"
                    onClick={() => removeSection(sec.id)}
                    title="Usuń sekcję"
                  >
                    Usuń sekcję
                  </button>
                )}
              </div>

              {/* Items */}
              <div className="me-items">
                {sec.items.map((item) => (
                  <div key={item.id} className="me-item">
                    <div className="me-item-row me-item-row--main">
                      <div className="me-item-name-wrap">
                        <label className="me-label">Nazwa</label>
                        <input
                          className="me-input"
                          type="text"
                          value={item.name}
                          onChange={e => updateItem(sec.id, item.id, { name: e.target.value })}
                          placeholder="np. Cappuccino, Espresso…"
                        />
                      </div>
                      <div className="me-item-price-wrap">
                        <label className="me-label">Cena (zł)</label>
                        <input
                          className="me-input me-input--price"
                          type="number"
                          min="0"
                          step="0.5"
                          value={item.price}
                          onChange={e => updateItem(sec.id, item.id, { price: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <button
                        type="button"
                        className="me-remove-btn me-remove-item"
                        onClick={() => removeItem(sec.id, item.id)}
                        title="Usuń pozycję"
                        disabled={sec.items.length === 1}
                      >
                        ✕
                      </button>
                    </div>

                    <div className="me-item-row">
                      <div style={{ flex: 1 }}>
                        <label className="me-label">Opis (opcjonalnie)</label>
                        <input
                          className="me-input"
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(sec.id, item.id, { description: e.target.value })}
                          placeholder="Krótki opis smaku, składników…"
                        />
                      </div>
                    </div>

                    <div className="me-item-badges">
                      <Badge
                        label="🌿 VEGE"
                        active={item.is_vege}
                        onClick={() => updateItem(sec.id, item.id, { is_vege: !item.is_vege })}
                        color="#2E7D32"
                      />
                      <Badge
                        label="🌶 HOT"
                        active={item.is_hot}
                        onClick={() => updateItem(sec.id, item.id, { is_hot: !item.is_hot })}
                        color="#B83232"
                      />
                      <Badge
                        label="⊘ NIEDOSTĘPNE"
                        active={item.is_unavailable}
                        onClick={() => updateItem(sec.id, item.id, { is_unavailable: !item.is_unavailable })}
                        color="#7A6050"
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="me-add-item-btn"
                  onClick={() => addItem(sec.id)}
                >
                  + Dodaj pozycję
                </button>
              </div>
            </div>
          ))}

          <button type="button" className="me-add-section-btn" onClick={addSection}>
            + Dodaj sekcję
          </button>
        </div>

        {/* Footer */}
        <div className="me-footer">
          {saveError && <div className="form-error" role="alert">{saveError}</div>}
          {saveSuccess && <div className="form-success" role="status">Menu zostało zapisane.</div>}
          <div className="me-footer-actions">
            <button type="button" className="btn btn--outline-dark" onClick={onClose}>
              Anuluj
            </button>
            <button
              type="button"
              className="btn btn--primary"
              style={{ width: 'auto', minWidth: '160px' }}
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Zapisywanie…' : 'Zapisz menu'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}