import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Languages, Download, Upload, Loader2, FileText, CheckCircle2, AlertTriangle, Search } from 'lucide-react'
import { API_URL } from '../config'
import { formatCurrency, formatDate, makeCollator, type LocaleFormat } from '../utils/localeFormat'
import { useI18n } from '../i18n'

// ── Types (zgodne z backend/app/schemas/translation.py) ───────────────────

type TrState = 'disabled' | 'not_generated' | 'awaiting_upload' | 'current' | 'stale'

interface LanguageInfo {
  code: string
  name_en: string
  native_name: string
  dir: 'ltr' | 'rtl'
  locale: string
  collator_locale: string
}

interface PackageInfo {
  id: string
  version: number
  language: string
  source_language: string
  created_at: string
  units_count: number
  is_current: boolean
}

interface PackageFile extends PackageInfo {
  filename: string
  content: string
}

interface Overview {
  settings: {
    primary_language: string
    secondary_language: string | null
    currency: string
    time_zone: string
  }
  status: {
    state: TrState
    secondary_language: string | null
    units_count: number
    translation: { language: string; package_version: number; uploaded_at: string; units_count: number } | null
    latest_package: PackageInfo | null
    changes: { added: number; removed: number } | null
  }
}

interface Props {
  token: string
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Błąd API z surowym `detail` — tłumaczenie robi komponent (errMsg). */
class ApiError extends Error {
  detail: unknown
  constructor(detail: unknown) { super('api'); this.detail = detail }
}

async function api<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(data?.detail)
  return data as T
}

function triggerDownload(p: { filename: string; content: string }) {
  const url = URL.createObjectURL(new Blob([p.content], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = p.filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function timeZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    const list = intl.supportedValuesOf?.('timeZone')
    if (list && list.length) return list.includes('UTC') ? list : ['UTC', ...list]
  } catch { /* fallback poniżej */ }
  return ['Europe/Warsaw', 'UTC']
}

function SearchableSelect({ label, value, onChange, options, placeholder, emptyLabel }: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; searchText?: string }[]
  placeholder: string
  emptyLabel?: string
}) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const filtered = options.filter(option => `${option.label} ${option.searchText ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const visible = filtered.some(option => option.value === value) || !value
    ? filtered
    : [{ value, label: value }, ...filtered]

  return (
    <div className="field language-picker">
      <label className="field__label">{label}</label>
      <div className="language-picker__search">
        <Search size={16} aria-hidden="true" />
        <input className="me-input" type="search" value={query} placeholder={placeholder}
          aria-label={t('languages.search.aria', { label: label.toLocaleLowerCase() })} onChange={e => setQuery(e.target.value)} />
      </div>
      <select className="me-input language-picker__select" value={value}
        onChange={e => onChange(e.target.value)} size={Math.min(Math.max(visible.length, 2), 6)}>
        {emptyLabel && <option value="">{emptyLabel}</option>}
        {visible.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        {!filtered.length && <option value={value} disabled>{t('languages.search.noResults')}</option>}
      </select>
      <span className="language-picker__count">{t('languages.results', { count: filtered.length })}</span>
    </div>
  )
}

const STATE_BADGE: Record<TrState, string> = {
  disabled:        'pf-badge--private',
  not_generated:   'pf-badge--private',
  awaiting_upload: 'pf-badge--warn',
  current:         'pf-badge--public',
  stale:           'pf-badge--warn',
}

// ═════════════════════════════════════════════════════════════════════════════

export default function LanguagesCard({ token }: Props) {
  const { t, tApi } = useI18n()
  const [languages, setLanguages]   = useState<LanguageInfo[]>([])
  const [currencies, setCurrencies] = useState<string[]>([])
  const [overview, setOverview]     = useState<Overview | null>(null)
  const [loading, setLoading]       = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  const [primary, setPrimary]     = useState('pl')
  const [secondary, setSecondary] = useState('')
  const [currency, setCurrency]   = useState('PLN')
  const [timeZone, setTimeZone]   = useState('Europe/Warsaw')

  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [generating, setGenerating] = useState(false)
  const [readyPkg, setReadyPkg]     = useState<PackageFile | null>(null)
  const [genError, setGenError]     = useState<string | null>(null)

  const [file, setFile]             = useState<File | null>(null)
  const [uploading, setUploading]   = useState(false)
  const [uploadMsg, setUploadMsg]   = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const zones = useMemo(timeZones, [])

  /** Błąd API (string lub lista błędów walidacji) → komunikat w języku panelu. */
  const errMsg = (e: unknown, fallbackKey: string): string => {
    if (!(e instanceof ApiError)) return t(fallbackKey)
    const d = e.detail
    if (Array.isArray(d)) {
      const msgs = d
        .map(x => String((x as { msg?: string }).msg ?? '').replace(/^Value error, /, ''))
        .filter(Boolean)
      return msgs.length ? msgs.map(m => tApi(m, fallbackKey)).join(' ') : t(fallbackKey)
    }
    return tApi(d, fallbackKey)
  }

  const applyOverview = useCallback((o: Overview) => {
    setOverview(o)
    setPrimary(o.settings.primary_language)
    setSecondary(o.settings.secondary_language ?? '')
    setCurrency(o.settings.currency)
    setTimeZone(o.settings.time_zone)
  }, [])

  const refresh = useCallback(async () => {
    try {
      applyOverview(await api<Overview>(token, '/i18n/settings'))
    } catch { /* zostaw poprzedni stan */ }
  }, [token, applyOverview])

  useEffect(() => {
    (async () => {
      try {
        const [opts, ov] = await Promise.all([
          api<{ languages: LanguageInfo[]; currencies: string[] }>(token, '/i18n/options'),
          api<Overview>(token, '/i18n/settings'),
        ])
        setLanguages(opts.languages)
        setCurrencies(opts.currencies)
        applyOverview(ov)
      } catch {
        setLoadFailed(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [token, applyOverview])

  // Treść mogła się zmienić w innej zakładce (profil) — odśwież status.
  useEffect(() => {
    window.addEventListener('caffenacci:profile-saved', refresh)
    return () => window.removeEventListener('caffenacci:profile-saved', refresh)
  }, [refresh])

  // ── Nazwy języków: angielska i lokalna (zostają takie same w obu językach panelu) ──

  const labelOf = useMemo(() => {
    const byCode = new Map(languages.map(l => [l.code, l]))
    return (code: string): string => {
      const l = byCode.get(code)
      if (!l) return code
      return l.name_en.toLowerCase() === l.native_name.toLowerCase() ? l.name_en : `${l.name_en} — ${l.native_name}`
    }
  }, [languages])

  const sortedLanguages = useMemo(() => {
    const c = makeCollator('en')
    return languages.slice().sort((a, b) => c.compare(labelOf(a.code), labelOf(b.code)))
  }, [languages, labelOf])

  const saved = overview?.settings
  const dirty = !!saved && (
    saved.primary_language !== primary ||
    (saved.secondary_language ?? '') !== secondary ||
    saved.currency !== currency ||
    saved.time_zone !== timeZone
  )

  // ── Akcje ───────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true); setMsg(null)
    try {
      const ov = await api<Overview>(token, '/i18n/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_language: primary,
          secondary_language: secondary || null,
          currency,
          time_zone: timeZone,
        }),
      })
      applyOverview(ov)
      setReadyPkg(null)
      setMsg({ type: 'ok', text: t('languages.saved') })
      window.dispatchEvent(new Event('caffenacci:profile-saved'))
    } catch (e) {
      setMsg({ type: 'err', text: errMsg(e, 'languages.err.save') })
    } finally { setSaving(false) }
  }

  const handleGenerate = async () => {
    setGenerating(true); setGenError(null)
    try {
      setReadyPkg(await api<PackageFile>(token, '/i18n/packages', { method: 'POST' }))
      await refresh()
    } catch (e) {
      setGenError(errMsg(e, 'languages.err.generate'))
    } finally { setGenerating(false) }
  }

  const handleDownloadLatest = async (id: string) => {
    setGenError(null)
    try {
      triggerDownload(await api<PackageFile>(token, `/i18n/packages/${id}`))
    } catch (e) {
      setGenError(errMsg(e, 'languages.err.download'))
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setUploadMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      applyOverview(await api<Overview>(token, '/i18n/upload', { method: 'POST', body: fd }))
      setUploadMsg({ type: 'ok', text: t('languages.uploaded') })
      setFile(null); setReadyPkg(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setUploadMsg({ type: 'err', text: errMsg(e, 'languages.err.upload') })
    } finally { setUploading(false) }
  }

  // ── Podgląd formatowania (te same helpery co strona klienta) ──

  const previewFor = (code: string): { f: LocaleFormat; dir: string } | null => {
    const l = languages.find(x => x.code === code)
    if (!l) return null
    return { f: { locale: l.locale, dir: l.dir, collator_locale: l.collator_locale, currency, time_zone: timeZone }, dir: l.dir }
  }
  const today = new Date().toISOString().slice(0, 10)

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /><p>{t('languages.loading')}</p></div>
  }
  if (loadFailed || !overview) {
    return <div className="form-error" role="alert">{t('languages.err.load')}</div>
  }

  const st = overview.status
  const secLabel = saved?.secondary_language ? labelOf(saved.secondary_language) : ''
  const readyInfo: { id: string; version: number } | null =
    readyPkg ?? (st.latest_package?.is_current ? st.latest_package : null)
  const changesText = st.changes
    ? t('languages.stale.changes', { added: st.changes.added, removed: st.changes.removed })
    : ''

  return (
    <div className="info-card">
      <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span className="info-card__icon"><Languages size={20} /></span>
          <h2 className="info-card__title">{t('languages.title')}</h2>
        </div>
        {saved?.secondary_language && (
          <span className={`pf-badge ${STATE_BADGE[st.state]}`}>{t(`languages.state.${st.state}`)}</span>
        )}
      </div>

      <div className="info-card__body">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem', lineHeight: 1.6 }}>
          {t('languages.intro')}
        </p>

        {msg && <div className={msg.type === 'ok' ? 'form-success' : 'form-error'}>{msg.text}</div>}

        <details className="language-settings-group">
          <summary className="language-settings-group__heading"><strong>{t('languages.group.languages')}</strong><span>{t('languages.group.languages.hint')}</span></summary>
          <div className="language-picker-grid">
            <SearchableSelect label={t('languages.primary')} value={primary}
              onChange={value => { setPrimary(value); if (value === secondary) setSecondary('') }}
              placeholder={t('languages.searchLanguage')} options={sortedLanguages.map(l => ({ value: l.code, label: labelOf(l.code), searchText: `${l.code} ${l.name_en} ${l.native_name}` }))} />
            <SearchableSelect label={t('languages.secondary')} value={secondary}
              onChange={setSecondary} placeholder={t('languages.searchLanguage')} emptyLabel={t('languages.none')}
              options={sortedLanguages.filter(l => l.code !== primary).map(l => ({ value: l.code, label: labelOf(l.code), searchText: `${l.code} ${l.name_en} ${l.native_name}` }))} />
          </div>
        </details>

        <details className="language-settings-group">
          <summary className="language-settings-group__heading"><strong>{t('languages.group.regional')}</strong><span>{t('languages.group.regional.hint')}</span></summary>
          <div className="language-picker-grid">
            <SearchableSelect label={t('languages.currency')} value={currency} onChange={setCurrency}
              placeholder={t('languages.searchCurrency')} options={currencies.map(c => ({ value: c, label: c }))} />
            <SearchableSelect label={t('languages.timeZone')} value={timeZone} onChange={setTimeZone}
              placeholder={t('languages.searchTimeZone')} options={[...new Set([timeZone, ...zones])].map(z => ({ value: z, label: z, searchText: z.replaceAll('_', ' ') }))} />
          </div>
        </details>

        {/* Podgląd formatów dla wybranych języków */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {[primary, secondary].filter(Boolean).map(code => {
            const p = previewFor(code)
            if (!p) return null
            return (
              <div key={code} dir={p.dir} style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-dark)' }}>{labelOf(code)}:</strong>{' '}
                {formatCurrency(1234.5, p.f)} · {formatDate(today, p.f)}
              </div>
            )
          })}
        </div>

        <div>
          <button type="button" className="btn btn--primary" style={{ width: 'auto', marginTop: 0 }}
            onClick={handleSave} disabled={saving || !dirty}>
            {saving ? t('common.saving') : t('languages.save')}
          </button>
        </div>

        {/* ── Tłumaczenie ─────────────────────────────────────────────────── */}
        {saved?.secondary_language && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="res-settings-block__title" style={{ marginBottom: 0 }}>
              {t('languages.translation', { lang: secLabel })}
            </div>

            {dirty && (
              <div className="form-error">{t('languages.dirty')}</div>
            )}

            {st.state === 'stale' && (
              <div className="form-error" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{t('languages.stale', { changes: changesText, lang: secLabel })}</span>
              </div>
            )}

            {st.state === 'current' && st.translation && (
              <div className="form-success" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <CheckCircle2 size={16} />
                {t('languages.current', { version: st.translation.package_version, texts: t('languages.texts', { count: st.translation.units_count }) })}
              </div>
            )}

            {/* Krok 1 — generowanie */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div className="me-label">{t('languages.step1')}</div>
              <div>
                <button type="button" className="btn btn--outline-dark"
                  style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={handleGenerate} disabled={generating || dirty}>
                  {generating ? <Loader2 size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <FileText size={16} />}
                  {t('languages.generate')}
                </button>
                {st.units_count > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                    {t('languages.toTranslate', { texts: t('languages.texts', { count: st.units_count }) })}
                  </span>
                )}
              </div>
              {genError && <div className="form-error">{genError}</div>}

              {readyInfo && (
                <div className="res-table-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-dark)' }}>
                    <strong translate="no">{readyPkg ? readyPkg.filename : t('languages.file.title', { version: readyInfo.version })}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t('languages.file.sub', { version: readyInfo.version })}
                    </div>
                  </div>
                  <button type="button" className="btn btn--primary btn--sm"
                    style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={() => readyPkg ? triggerDownload(readyPkg) : handleDownloadLatest(readyInfo.id)}>
                    <Download size={15} /> {t('languages.download')}
                  </button>
                </div>
              )}
            </div>

            {/* Krok 2 — instrukcja */}
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
              <div className="me-label" style={{ marginBottom: '0.25rem' }}>{t('languages.step2', { lang: secLabel })}</div>
              {t('languages.step2.a')} <code>[[[0001]]]</code> {t('languages.step2.b')}
            </div>

            {/* Krok 3 — upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div className="me-label">{t('languages.step3')}</div>
              <div className="translation-file-row">
                <input ref={fileInputRef} className="translation-file-input" type="file" accept=".txt,text/plain"
                  onChange={e => { setFile(e.target.files?.[0] ?? null); setUploadMsg(null) }} />
                <button type="button" className="btn btn--outline-dark translation-file-button"
                  onClick={() => fileInputRef.current?.click()}>
                  <FileText size={16} /> {file ? t('languages.file.change') : t('languages.file.choose')}
                </button>
                <span className={`translation-file-name${file ? ' translation-file-name--selected' : ''}`} translate="no">
                  {file?.name ?? t('languages.file.none')}
                </span>
                <button type="button" className="btn btn--primary"
                  style={{ width: 'auto', marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={handleUpload} disabled={!file || uploading || dirty}>
                  {uploading ? <Loader2 size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Upload size={16} />}
                  {t('languages.upload')}
                </button>
              </div>
              {uploadMsg && <div className={uploadMsg.type === 'ok' ? 'form-success' : 'form-error'}>{uploadMsg.text}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}