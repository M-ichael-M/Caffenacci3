import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Languages, Download, Upload, Loader2, FileText, CheckCircle2, AlertTriangle } from 'lucide-react'
import { API_URL } from '../config'
import { formatCurrency, formatDate, makeCollator, type LocaleFormat } from '../utils/localeFormat'

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

async function api<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const d = data?.detail
    const msg =
      typeof d === 'string' ? d
      : Array.isArray(d) ? d.map((e: { msg?: string }) => e.msg ?? '').join(' ')
      : 'Wystąpił błąd. Spróbuj ponownie.'
    throw new Error(msg.replace(/^Value error, /, ''))
  }
  return data as T
}

function textsLabel(n: number): string {
  const mod10 = n % 10, mod100 = n % 100
  if (n === 1) return '1 tekst'
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${n} teksty`
  return `${n} tekstów`
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

const STATE_BADGE: Record<TrState, { cls: string; label: string }> = {
  disabled:        { cls: 'pf-badge--private', label: 'Brak języka dodatkowego' },
  not_generated:   { cls: 'pf-badge--private', label: 'Plik niewygenerowany' },
  awaiting_upload: { cls: 'pf-badge--warn',    label: 'Czeka na wgranie tłumaczenia' },
  current:         { cls: 'pf-badge--public',  label: 'Tłumaczenie aktualne' },
  stale:           { cls: 'pf-badge--warn',    label: 'Tłumaczenie nieaktualne' },
}

// ═════════════════════════════════════════════════════════════════════════════

export default function LanguagesCard({ token }: Props) {
  const [languages, setLanguages]   = useState<LanguageInfo[]>([])
  const [currencies, setCurrencies] = useState<string[]>([])
  const [overview, setOverview]     = useState<Overview | null>(null)
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState<string | null>(null)

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
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Nie udało się wczytać ustawień języków.')
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

  // ── Nazwy języków po polsku (Intl.DisplayNames) + sortowanie wg polskich reguł ──

  const labelOf = useMemo(() => {
    let dn: Intl.DisplayNames | null = null
    try { dn = new Intl.DisplayNames(['pl'], { type: 'language' }) } catch { /* brak wsparcia */ }
    const byCode = new Map(languages.map(l => [l.code, l]))
    return (code: string): string => {
      const l = byCode.get(code)
      if (!l) return code
      let pl: string | undefined
      try { pl = dn?.of(l.locale) } catch { /* ignore */ }
      const name = pl && pl !== l.locale ? pl : l.name_en
      return name.toLowerCase() === l.native_name.toLowerCase() ? l.native_name : `${name} — ${l.native_name}`
    }
  }, [languages])

  const sortedLanguages = useMemo(() => {
    const c = makeCollator('pl')
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
      setMsg({ type: 'ok', text: 'Ustawienia językowe zostały zapisane.' })
      window.dispatchEvent(new Event('caffenacci:profile-saved'))
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Błąd zapisu.' })
    } finally { setSaving(false) }
  }

  const handleGenerate = async () => {
    setGenerating(true); setGenError(null)
    try {
      setReadyPkg(await api<PackageFile>(token, '/i18n/packages', { method: 'POST' }))
      await refresh()
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Nie udało się wygenerować pliku.')
    } finally { setGenerating(false) }
  }

  const handleDownloadLatest = async (id: string) => {
    setGenError(null)
    try {
      triggerDownload(await api<PackageFile>(token, `/i18n/packages/${id}`))
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Nie udało się pobrać pliku.')
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true); setUploadMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      applyOverview(await api<Overview>(token, '/i18n/upload', { method: 'POST', body: fd }))
      setUploadMsg({ type: 'ok', text: 'Tłumaczenie zostało zapisane i jest już aktywne na stronie.' })
      setFile(null); setReadyPkg(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setUploadMsg({ type: 'err', text: e instanceof Error ? e.message : 'Błąd wgrywania pliku.' })
    } finally { setUploading(false) }
  }

  // ── Podgląd formatowania (używa tych samych helperów co przyszła strona klienta) ──

  const previewFor = (code: string): { f: LocaleFormat; dir: string } | null => {
    const l = languages.find(x => x.code === code)
    if (!l) return null
    return { f: { locale: l.locale, dir: l.dir, collator_locale: l.collator_locale, currency, time_zone: timeZone }, dir: l.dir }
  }
  const today = new Date().toISOString().slice(0, 10)

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /><p>Wczytywanie języków…</p></div>
  }
  if (loadError || !overview) {
    return <div className="form-error" role="alert">{loadError ?? 'Nie udało się wczytać ustawień języków.'}</div>
  }

  const st = overview.status
  const badge = STATE_BADGE[st.state]
  const secLabel = saved?.secondary_language ? labelOf(saved.secondary_language) : ''
  const readyInfo: { id: string; version: number } | null =
    readyPkg ?? (st.latest_package?.is_current ? st.latest_package : null)

  return (
    <div className="info-card">
      <div className="info-card__header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span className="info-card__icon"><Languages size={20} /></span>
          <h2 className="info-card__title">Języki strony</h2>
        </div>
        {saved?.secondary_language && <span className={`pf-badge ${badge.cls}`}>{badge.label}</span>}
      </div>

      <div className="info-card__body">
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem', lineHeight: 1.6 }}>
          Napisy systemowe (np. „Menu”, „Zarezerwuj stolik”, „Opinie”) strona tłumaczy sama.
          Teksty wpisane przez Ciebie — menu, opis, aktualności — przetłumaczysz plikiem, który tu wygenerujesz.
        </p>

        {msg && <div className={msg.type === 'ok' ? 'form-success' : 'form-error'}>{msg.text}</div>}

        <div className="field-row">
          <div className="field">
            <label className="field__label">Język podstawowy</label>
            <select className="me-input" style={{ cursor: 'pointer' }} value={primary}
              onChange={e => { setPrimary(e.target.value); if (e.target.value === secondary) setSecondary('') }}>
              {sortedLanguages.map(l => <option key={l.code} value={l.code}>{labelOf(l.code)}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Język dodatkowy (opcjonalnie)</label>
            <select className="me-input" style={{ cursor: 'pointer' }} value={secondary}
              onChange={e => setSecondary(e.target.value)}>
              <option value="">— brak —</option>
              {sortedLanguages.filter(l => l.code !== primary).map(l =>
                <option key={l.code} value={l.code}>{labelOf(l.code)}</option>)}
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label className="field__label">Waluta cen w menu</label>
            <select className="me-input" style={{ cursor: 'pointer' }} value={currency}
              onChange={e => setCurrency(e.target.value)}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field__label">Strefa czasowa kawiarni</label>
            <select className="me-input" style={{ cursor: 'pointer' }} value={timeZone}
              onChange={e => setTimeZone(e.target.value)}>
              {!zones.includes(timeZone) && <option value={timeZone}>{timeZone}</option>}
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </div>

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
            {saving ? 'Zapisywanie…' : 'Zapisz języki'}
          </button>
        </div>

        {/* ── Tłumaczenie ─────────────────────────────────────────────────── */}
        {saved?.secondary_language && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="res-settings-block__title" style={{ marginBottom: 0 }}>
              Tłumaczenie: {secLabel}
            </div>

            {dirty && (
              <div className="form-error">Zapisz zmiany języków, zanim wygenerujesz plik lub wgrasz tłumaczenie.</div>
            )}

            {st.state === 'stale' && (
              <div className="form-error" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  Treść strony zmieniła się od ostatniego tłumaczenia
                  {st.changes && ` (nowe lub zmienione: ${st.changes.added}, usunięte: ${st.changes.removed})`}.
                  Wygeneruj nowy plik, przetłumacz go i wgraj ponownie. Do tego czasu odwiedzający
                  nie zobaczą wersji „{secLabel}” — strona wyświetla się tylko w języku podstawowym.
                </span>
              </div>
            )}

            {st.state === 'current' && st.translation && (
              <div className="form-success" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <CheckCircle2 size={16} />
                Aktywne tłumaczenie z pliku v{st.translation.package_version} ({textsLabel(st.translation.units_count)}).
              </div>
            )}

            {/* Krok 1 — generowanie */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div className="me-label">1. Wygeneruj plik z tekstami</div>
              <div>
                <button type="button" className="btn btn--outline-dark"
                  style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={handleGenerate} disabled={generating || dirty}>
                  {generating ? <Loader2 size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <FileText size={16} />}
                  Wygeneruj plik do tłumaczenia
                </button>
                {st.units_count > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>
                    {textsLabel(st.units_count)} do przetłumaczenia
                  </span>
                )}
              </div>
              {genError && <div className="form-error">{genError}</div>}

              {readyInfo && (
                <div className="res-table-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-dark)' }}>
                    <strong>{readyPkg ? readyPkg.filename : `Plik do tłumaczenia — wersja v${readyInfo.version}`}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Wersja v{readyInfo.version} · odpowiada obecnej treści strony
                    </div>
                  </div>
                  <button type="button" className="btn btn--primary btn--sm"
                    style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                    onClick={() => readyPkg ? triggerDownload(readyPkg) : handleDownloadLatest(readyInfo.id)}>
                    <Download size={15} /> Pobierz plik
                  </button>
                </div>
              )}
            </div>

            {/* Krok 2 — instrukcja */}
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>
              <div className="me-label" style={{ marginBottom: '0.25rem' }}>2. Przetłumacz cały plik na: {secLabel}</div>
              Wklej całą zawartość (lub wgraj plik) do dowolnego tłumacza, np. Google Translate lub DeepL.
              W pliku są linie typu <code>[[[0001]]]</code> — to numery tekstów, składają się z samych cyfr,
              więc tłumacz ich nie zmieni. Nie usuwaj ich i nie przestawiaj. Wynik zapisz jako plik
              tekstowy (.txt, UTF-8).
            </div>

            {/* Krok 3 — upload */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div className="me-label">3. Wgraj przetłumaczony plik</div>
              <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input ref={fileInputRef} type="file" accept=".txt,text/plain"
                  onChange={e => { setFile(e.target.files?.[0] ?? null); setUploadMsg(null) }} />
                <button type="button" className="btn btn--primary"
                  style={{ width: 'auto', marginTop: 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  onClick={handleUpload} disabled={!file || uploading || dirty}>
                  {uploading ? <Loader2 size={16} style={{ animation: 'spin 0.9s linear infinite' }} /> : <Upload size={16} />}
                  Zapisz tłumaczenie
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