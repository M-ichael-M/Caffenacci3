import { useState, useEffect, useCallback } from 'react'
import {
  Eye, MousePointerClick, Users, Compass, ShoppingCart, CalendarDays, Star, QrCode,
  TrendingUp, TrendingDown, Copy, Check, RefreshCw, ShieldCheck, Gift,
} from 'lucide-react'
import { API_URL } from '../config'

// ── Typy (odpowiadają core/analytics.py: build_summary) ────────────────────

interface Totals { pageviews: number; visits: number; visitors: number }
interface Summary {
  days: number
  from: string
  to: string
  share_url: string | null
  totals: Totals
  previous: Totals
  series: ({ day: string } & Totals)[]
  sources: Record<string, number>
  devices: Record<string, number>
  events: Record<string, { total: number; dims: Record<string, number> }>
  impact: {
    orders: { placed: number; completed: number; revenue: number; unique_clients: number }
    reservations: { total: number; confirmed: number }
    reviews: { count: number; average: number | null }
    loyalty: { scanned_total: number; scanned_period: number; new_in_period: number; returning_in_period: number; transactions: number }
  }
}

type Metric = keyof Totals

interface Props { token: string }

// ── Etykiety ──────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Wejście bezpośrednie', caffenacci: 'Wyszukiwarka Caffenacci', qr: 'Kod QR',
  nfc: 'NFC', flyer: 'Ulotka / plakat', newsletter: 'Newsletter', social: 'Social media',
  search: 'Wyszukiwarki (Google itd.)', other: 'Inne strony',
}
const DEVICE_LABELS: Record<string, string> = { mobile: 'Telefon', desktop: 'Komputer', tablet: 'Tablet' }
const EVENT_LABELS: Record<string, string> = {
  menu_add: 'Dodania do zamówienia', checkout_open: 'Otwarcia podsumowania zamówienia',
  reservation_open: 'Otwarcia formularza rezerwacji', review_open: 'Otwarcia formularza opinii',
  phone_click: 'Kliknięcia w telefon', email_click: 'Kliknięcia w e-mail', map_click: 'Kliknięcia w mapę',
  social_click: 'Kliknięcia w social media', gallery_open: 'Otwarcia zdjęć z galerii',
  nav_click: 'Kliknięcia w nawigację', login_open: 'Kliknięcia „Zaloguj się”',
  register_open: 'Kliknięcia „Zarejestruj się”', lang_switch: 'Zmiany języka',
}
const RANGES = [7, 30, 90] as const

// ── Helpery ───────────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat('pl-PL')
const money = (n: number) => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n)

function shortDay(d: string) {
  // składamy datę z komponentów lokalnych — bez konwersji przez UTC
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}

function delta(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}

// ── Komponenty ────────────────────────────────────────────────────────────

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const d = delta(cur, prev)
  if (d === null) return <span className="an-delta an-delta--flat">{cur > 0 ? 'nowe' : '—'}</span>
  const up = d >= 0
  return (
    <span className={`an-delta ${up ? 'an-delta--up' : 'an-delta--down'}`}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {up ? '+' : ''}{d}%
    </span>
  )
}

function Kpi({ icon, label, value, hint, children }: {
  icon: React.ReactNode; label: string; value: string; hint?: string; children?: React.ReactNode
}) {
  return (
    <div className="an-kpi" title={hint}>
      <div className="an-kpi__top"><span className="an-kpi__icon">{icon}</span><span className="an-kpi__label">{label}</span></div>
      <div className="an-kpi__value">{value}</div>
      <div className="an-kpi__foot">{children}</div>
    </div>
  )
}

function TrendChart({ data, metric }: { data: Summary['series']; metric: Metric }) {
  const W = 640, H = 200, P = { l: 36, r: 12, t: 12, b: 26 }
  const vals = data.map(d => d[metric])
  const max = Math.max(1, ...vals)
  const x = (i: number) => P.l + (data.length <= 1 ? 0 : (i * (W - P.l - P.r)) / (data.length - 1))
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max)
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(vals.length - 1).toFixed(1)},${H - P.b} L${x(0).toFixed(1)},${H - P.b} Z`
  const labelIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="an-chart" role="img" aria-label="Wykres trendu">
      {[0, 0.5, 1].map(t => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(max * t)} y2={y(max * t)} className="an-chart__grid" />
          <text x={P.l - 6} y={y(max * t) + 4} textAnchor="end" className="an-chart__tick">{Math.round(max * t)}</text>
        </g>
      ))}
      <path d={area} className="an-chart__area" />
      <path d={line} className="an-chart__line" />
      {vals.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={7} className="an-chart__hit">
          <title>{shortDay(data[i].day)}: {nf.format(v)}</title>
        </circle>
      ))}
      {labelIdx.map(i => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="an-chart__tick">{shortDay(data[i].day)}</text>
      ))}
    </svg>
  )
}

function BarList({ items, total }: { items: { key: string; label: string; value: number }[]; total?: number }) {
  const sum = total ?? items.reduce((s, i) => s + i.value, 0)
  const max = Math.max(1, ...items.map(i => i.value))
  if (items.length === 0) return <p className="an-empty">Brak danych w tym okresie.</p>
  return (
    <div className="an-bars">
      {items.map(i => (
        <div key={i.key} className="an-bar">
          <div className="an-bar__row">
            <span>{i.label}</span>
            <span className="an-bar__val">{nf.format(i.value)}{sum > 0 && <em> · {Math.round((i.value / sum) * 100)}%</em>}</span>
          </div>
          <div className="an-bar__track"><div className="an-bar__fill" style={{ width: `${(i.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="info-card">
      <div className="info-card__header"><span className="info-card__icon">{icon}</span><h2 className="info-card__title">{title}</h2></div>
      <div className="info-card__body">{children}</div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════

export default function AnalyticsTab({ token }: Props) {
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('visits')
  const [copied, setCopied] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/analytics/summary?days=${days}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError('Nie udało się wczytać statystyk. Spróbuj ponownie.')
    } finally { setLoading(false) }
  }, [token, days])

  useEffect(() => { fetchData() }, [fetchData])

  const copyLink = async () => {
    if (!data?.share_url) return
    try { await navigator.clipboard.writeText(data.share_url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignoruj */ }
  }

  if (loading && !data) {
    return <div className="loading-state"><div className="loading-spinner" /><p>Wczytywanie statystyk…</p></div>
  }
  if (error && !data) return <div className="form-error" role="alert">{error}</div>
  if (!data) return null

  const { totals, previous, impact: imp } = data
  const viaCaffenacci = (data.sources.caffenacci ?? 0) + (data.sources.qr ?? 0)
  const eventTotal = (n: string) => data.events[n]?.total ?? 0
  const noTraffic = totals.pageviews === 0

  const sourceItems = Object.entries(data.sources).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, label: SOURCE_LABELS[k] ?? k, value: v }))
  const deviceItems = Object.entries(data.devices).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, label: DEVICE_LABELS[k] ?? k, value: v }))
  const clickItems = Object.entries(data.events).sort((a, b) => b[1].total - a[1].total)
    .map(([k, v]) => ({ key: k, label: EVENT_LABELS[k] ?? k, value: v.total }))

  const funnel = [
    { key: 'visits', label: 'Wizyty na stronie', value: totals.visits },
    { key: 'menu_add', label: 'Dodali pozycję do zamówienia', value: eventTotal('menu_add') },
    { key: 'checkout', label: 'Otworzyli podsumowanie', value: eventTotal('checkout_open') },
    { key: 'orders', label: 'Złożyli zamówienie', value: imp.orders.placed },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="page-header__eyebrow">Zarządzanie</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
            Statystyki i wpływ Caffenacci
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {RANGES.map(r => (
            <button key={r} type="button" className={`res-mode-btn${days === r ? ' res-mode-btn--active' : ''}`} onClick={() => setDays(r)}>
              {r} dni
            </button>
          ))}
          <button type="button" className="btn btn--outline-dark" style={{ width: 'auto', padding: '0.5rem 0.875rem' }} onClick={fetchData} aria-label="Odśwież">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="an-privacy">
        <ShieldCheck size={16} />
        <span>
          Statystyki ruchu są zbierane bez cookies i bez zapisu czegokolwiek na urządzeniu gościa. Nie przechowujemy adresów IP;
          skróty odwiedzających są ważne jeden dzień i kasowane po 2 dniach. „Odwiedzający” to goście liczeni <strong>dziennie</strong>
          {' '}(ta sama osoba jutro policzy się ponownie). Dane z kodów lojalnościowych, zamówień i rezerwacji są dokładne i pochodzą z systemu.
        </span>
      </div>

      {/* ── KPI ruchu ── */}
      <div className="an-kpis">
        <Kpi icon={<Eye size={16} />} label="Odsłony" value={nf.format(totals.pageviews)} hint="Wszystkie wyświetlenia strony">
          <Delta cur={totals.pageviews} prev={previous.pageviews} /> <span>vs poprzednie {days} dni</span>
        </Kpi>
        <Kpi icon={<Compass size={16} />} label="Wizyty" value={nf.format(totals.visits)} hint="Wizyta = wejście po min. 30 min przerwy">
          <Delta cur={totals.visits} prev={previous.visits} /> <span>vs poprzednie {days} dni</span>
        </Kpi>
        <Kpi icon={<Users size={16} />} label="Odwiedzający" value={nf.format(totals.visitors)} hint="Suma unikalnych gości z każdego dnia">
          <Delta cur={totals.visitors} prev={previous.visitors} /> <span>(dziennie, sumowani)</span>
        </Kpi>
        <Kpi icon={<QrCode size={16} />} label="Wizyty przez Caffenacci" value={nf.format(viaCaffenacci)} hint="Wyszukiwarka Caffenacci + kody QR">
          <span>{totals.visits > 0 ? `${Math.round((viaCaffenacci / totals.visits) * 100)}% wszystkich wizyt` : '—'}</span>
        </Kpi>
      </div>

      {/* ── Trend ── */}
      <Card icon={<TrendingUp size={18} />} title="Trend">
        <div className="subtab-row" style={{ marginBottom: '0.5rem' }}>
          {([['visits', 'Wizyty'], ['pageviews', 'Odsłony'], ['visitors', 'Odwiedzający']] as [Metric, string][]).map(([k, l]) => (
            <button key={k} type="button" className={`subtab-btn${metric === k ? ' subtab-btn--active' : ''}`} onClick={() => setMetric(k)}>{l}</button>
          ))}
        </div>
        {noTraffic
          ? <p className="an-empty">Brak ruchu w tym okresie. Statystyki pojawią się, gdy ktoś odwiedzi opublikowaną stronę kawiarni.</p>
          : <TrendChart data={data.series} metric={metric} />}
      </Card>

      {/* ── Wpływ Caffenacci (dokładne dane z systemu) ── */}
      <div className="an-section-title">Co Caffenacci daje Twojej kawiarni <span>(ostatnie {days} dni)</span></div>
      <div className="an-kpis">
        <Kpi icon={<Gift size={16} />} label="Goście z kodem Caffenacci" value={nf.format(imp.loyalty.scanned_period)}
             hint="Unikalni goście, którym obsługa zeskanowała / wpisała kod">
          <span>{nf.format(imp.loyalty.new_in_period)} nowych · {nf.format(imp.loyalty.returning_in_period)} wracających</span>
        </Kpi>
        <Kpi icon={<Users size={16} />} label="Wszyscy kiedykolwiek zeskanowani" value={nf.format(imp.loyalty.scanned_total)}
             hint="Unikalni goście w całej historii programu lojalnościowego">
          <span>{nf.format(imp.loyalty.transactions)} operacji w okresie</span>
        </Kpi>
        <Kpi icon={<ShoppingCart size={16} />} label="Zamówienia online" value={nf.format(imp.orders.placed)}>
          <span>{nf.format(imp.orders.completed)} zrealizowanych · {money(imp.orders.revenue)}</span>
        </Kpi>
        <Kpi icon={<CalendarDays size={16} />} label="Rezerwacje" value={nf.format(imp.reservations.total)}>
          <span>{nf.format(imp.reservations.confirmed)} potwierdzonych</span>
        </Kpi>
        <Kpi icon={<Star size={16} />} label="Nowe opinie" value={nf.format(imp.reviews.count)}>
          <span>{imp.reviews.average !== null ? `średnio ${imp.reviews.average.toFixed(1)} ★` : 'brak ocen'}</span>
        </Kpi>
        <Kpi icon={<MousePointerClick size={16} />} label="Kliknięcia w kontakt i mapę"
             value={nf.format(eventTotal('phone_click') + eventTotal('email_click') + eventTotal('map_click'))}>
          <span>telefon, e-mail, mapa</span>
        </Kpi>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        <Card icon={<Compass size={18} />} title="Skąd przychodzą goście"><BarList items={sourceItems} /></Card>
        <Card icon={<MousePointerClick size={18} />} title="Co robią na stronie"><BarList items={clickItems} total={undefined} /></Card>
        <Card icon={<ShoppingCart size={18} />} title="Od wizyty do zamówienia">
          <BarList items={funnel} total={funnel[0].value} />
          <p className="an-note">Kroki pośrednie to liczba akcji (jeden gość może wykonać kilka). Zamówienia pochodzą z systemu.</p>
        </Card>
        <Card icon={<Users size={18} />} title="Urządzenia"><BarList items={deviceItems} /></Card>
      </div>

      {data.share_url && (
        <Card icon={<QrCode size={18} />} title="Zmierz skuteczność kodu QR i ulotek">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem', lineHeight: 1.6 }}>
            Użyj tego adresu w kodzie QR na stolikach, plakacie lub ulotce. Wejścia z niego zobaczysz powyżej jako „Kod QR”.
            W innych materiałach zamień końcówkę <code>src=qr</code> na <code>flyer</code>, <code>nfc</code>, <code>newsletter</code> lub <code>social</code>.
          </p>
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <code className="an-link">{data.share_url}</code>
            <button type="button" className="btn btn--outline-dark btn--sm" style={{ width: 'auto', display: 'inline-flex', gap: '0.4rem' }} onClick={copyLink}>
              {copied ? <><Check size={14} /> Skopiowano</> : <><Copy size={14} /> Kopiuj</>}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
