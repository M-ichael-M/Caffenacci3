import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Eye, MousePointerClick, Users, Compass, ShoppingCart, CalendarDays, Star, QrCode,
  TrendingUp, TrendingDown, Copy, Check, RefreshCw, ShieldCheck, Gift,
} from 'lucide-react'
import { API_URL } from '../config'
import { useI18n } from '../i18n'
import { formatMoney } from '../utils/currency'
import { useCafeSettings } from './CafeSettingsContext'

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
    orders: { placed: number; completed: number; revenue_by_currency: Record<string, number>; unique_clients: number }
    reservations: { total: number; confirmed: number }
    reviews: { count: number; average: number | null }
    loyalty: { scanned_total: number; scanned_period: number; new_in_period: number; returning_in_period: number; transactions: number }
  }
}

type Metric = keyof Totals

interface Props { token: string }

const RANGES = [7, 30, 90] as const

// ── Helpery ───────────────────────────────────────────────────────────────

/** Formatery liczb / walut / dat w języku panelu. */
function useFmt() {
  const { locale } = useI18n()
  return useMemo(() => {
    const nf = new Intl.NumberFormat(locale)
    return {
      nf,
      money: (n: number, cur: string) => formatMoney(n, locale, cur),
      shortDay: (d: string) => {
        // składamy datę z komponentów lokalnych — bez konwersji przez UTC
        const [y, m, day] = d.split('-').map(Number)
        return new Date(y, m - 1, day).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
      },
    }
  }, [locale])
}

function delta(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}

// ── Komponenty ────────────────────────────────────────────────────────────

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const { t } = useI18n()
  const d = delta(cur, prev)
  if (d === null) return <span className="an-delta an-delta--flat">{cur > 0 ? t('analytics.delta.new') : '—'}</span>
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

/** Oś Y z całkowitymi, równymi podziałkami (bez powtórzeń i dziur). */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 4) {
    const top = Math.max(1, Math.ceil(max))
    return { top, ticks: Array.from({ length: top + 1 }, (_, i) => i) }
  }
  const raw = max / 4
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 5, 10].map(m => m * pow).find(s => s >= raw) ?? raw
  const top = step * Math.ceil(max / step)
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return { top, ticks }
}

function TrendChart({ data, metric }: { data: Summary['series']; metric: Metric }) {
  const { t } = useI18n()
  const { nf, shortDay } = useFmt()
  const W = 640, H = 200, P = { l: 40, r: 12, t: 12, b: 26 }
  const vals = data.map(d => d[metric])
  const { top, ticks } = niceScale(Math.max(0, ...vals))
  const x = (i: number) => P.l + (data.length <= 1 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (data.length - 1))
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / top)
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${x(vals.length - 1).toFixed(1)},${H - P.b} L${x(0).toFixed(1)},${H - P.b} Z`
  const labelIdx = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="an-chart" role="img" aria-label={t('analytics.trend.chartAria')}>
      {ticks.map(tk => (
        <g key={tk}>
          <line x1={P.l} x2={W - P.r} y1={y(tk)} y2={y(tk)} className="an-chart__grid" />
          <text x={P.l - 6} y={y(tk) + 4} textAnchor="end" className="an-chart__tick">{nf.format(tk)}</text>
        </g>
      ))}
      <path d={area} className="an-chart__area" />
      <path d={line} className="an-chart__line" />
      {vals.map((v, i) => (
        <g key={i}>
          {data.length <= 31 && <circle cx={x(i)} cy={y(v)} r={2.5} className="an-chart__dot" />}
          <circle cx={x(i)} cy={y(v)} r={8} className="an-chart__hit">
            <title>{shortDay(data[i].day)}: {nf.format(v)}</title>
          </circle>
        </g>
      ))}
      {labelIdx.map(i => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="an-chart__tick">{shortDay(data[i].day)}</text>
      ))}
    </svg>
  )
}

function BarList({ items, total }: { items: { key: string; label: string; value: number }[]; total?: number }) {
  const { t } = useI18n()
  const { nf } = useFmt()
  const sum = total ?? items.reduce((s, i) => s + i.value, 0)
  const max = Math.max(1, ...items.map(i => i.value))
  if (items.length === 0) return <p className="an-empty">{t('analytics.empty')}</p>
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
  const { t } = useI18n()
  const { nf, money } = useFmt()
  const { currency } = useCafeSettings()
  const [days, setDays] = useState<number>(30)
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [metric, setMetric] = useState<Metric>('visits')
  const [copied, setCopied] = useState(false)

  /** Waluty pozostają oddzielne; waluta kawiarni jest wyświetlana jako pierwsza. */
  const moneyBy = (m: Record<string, number>) => {
    const entries = Object.entries(m).sort(([a], [b]) =>
      Number(b === currency) - Number(a === currency) || a.localeCompare(b))
    return entries.length ? entries.map(([c, v]) => money(v, c)).join(' + ') : money(0, currency)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`${API_URL}/analytics/summary?days=${days}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error()
      setData(await res.json())
    } catch {
      setError(true)
    } finally { setLoading(false) }
  }, [token, days])

  useEffect(() => { fetchData() }, [fetchData])

  const copyLink = async () => {
    if (!data?.share_url) return
    try { await navigator.clipboard.writeText(data.share_url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignoruj */ }
  }

  /** Etykieta z słownika; dla nieznanego klucza (np. nowe zdarzenie) pokazuje surowy klucz. */
  const lbl = (prefix: string, k: string) => {
    const key = `${prefix}.${k}`
    const v = t(key)
    return v === key ? k : v
  }

  if (loading && !data) {
    return <div className="loading-state"><div className="loading-spinner" /><p>{t('analytics.loading')}</p></div>
  }
  if (error && !data) return <div className="form-error" role="alert">{t('analytics.err.load')}</div>
  if (!data) return null

  const { totals, previous, impact: imp } = data
  const viaCaffenacci = (data.sources.caffenacci ?? 0) + (data.sources.qr ?? 0)
  const eventTotal = (n: string) => data.events[n]?.total ?? 0
  const noTraffic = totals.pageviews === 0

  const sourceItems = Object.entries(data.sources).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, label: lbl('analytics.source', k), value: v }))
  const deviceItems = Object.entries(data.devices).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k, label: lbl('analytics.device', k), value: v }))
  const clickItems = Object.entries(data.events).sort((a, b) => b[1].total - a[1].total)
    .map(([k, v]) => ({ key: k, label: lbl('analytics.event', k), value: v.total }))

  const funnel = [
    { key: 'visits', label: t('analytics.funnel.visits'), value: totals.visits },
    { key: 'menu_add', label: t('analytics.funnel.menuAdd'), value: eventTotal('menu_add') },
    { key: 'checkout', label: t('analytics.funnel.checkout'), value: eventTotal('checkout_open') },
    { key: 'orders', label: t('analytics.funnel.orders'), value: imp.orders.placed },
  ]

  const vsPrev = t('analytics.vsPrevious', { days })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="page-header__eyebrow">{t('common.management')}</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.625rem', fontWeight: 600, color: 'var(--text-dark)', letterSpacing: '-0.01em' }}>
            {t('analytics.title')}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {RANGES.map(r => (
            <button key={r} type="button" className={`res-mode-btn${days === r ? ' res-mode-btn--active' : ''}`} onClick={() => setDays(r)}>
              {t('analytics.range', { count: r })}
            </button>
          ))}
          <button type="button" className="btn btn--outline-dark" style={{ width: 'auto', padding: '0.5rem 0.875rem' }} onClick={fetchData} aria-label={t('common.refresh')}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="an-privacy">
        <ShieldCheck size={16} />
        <span>
          {t('analytics.privacy.before')} <strong>{t('analytics.privacy.strong')}</strong> {t('analytics.privacy.after')}
        </span>
      </div>

      {/* ── KPI ruchu ── */}
      <div className="an-kpis">
        <Kpi icon={<Eye size={16} />} label={t('analytics.pageviews')} value={nf.format(totals.pageviews)} hint={t('analytics.pageviews.hint')}>
          <Delta cur={totals.pageviews} prev={previous.pageviews} /> <span>{vsPrev}</span>
        </Kpi>
        <Kpi icon={<Compass size={16} />} label={t('analytics.visits')} value={nf.format(totals.visits)} hint={t('analytics.visits.hint')}>
          <Delta cur={totals.visits} prev={previous.visits} /> <span>{vsPrev}</span>
        </Kpi>
        <Kpi icon={<Users size={16} />} label={t('analytics.visitors')} value={nf.format(totals.visitors)} hint={t('analytics.visitors.hint')}>
          <Delta cur={totals.visitors} prev={previous.visitors} /> <span>{t('analytics.visitors.foot')}</span>
        </Kpi>
        <Kpi icon={<QrCode size={16} />} label={t('analytics.viaCaffenacci')} value={nf.format(viaCaffenacci)} hint={t('analytics.viaCaffenacci.hint')}>
          <span>{totals.visits > 0 ? t('analytics.viaCaffenacci.foot', { pct: Math.round((viaCaffenacci / totals.visits) * 100) }) : '—'}</span>
        </Kpi>
      </div>

      {/* ── Trend ── */}
      <Card icon={<TrendingUp size={18} />} title={t('analytics.trend')}>
        <div className="an-metric-switch" role="group" aria-label={t('analytics.trend.aria')}>
          {([['visits', t('analytics.visits'), Compass], ['pageviews', t('analytics.pageviews'), Eye], ['visitors', t('analytics.visitors'), Users]] as [Metric, string, typeof Compass][]).map(([k, l, Icon]) => (
            <button key={k} type="button" className={`an-metric-switch__btn${metric === k ? ' an-metric-switch__btn--active' : ''}`} onClick={() => setMetric(k)} aria-pressed={metric === k}>
              <Icon size={15} aria-hidden="true" />{l}
            </button>
          ))}
        </div>
        {noTraffic
          ? <p className="an-empty">{t('analytics.trend.empty')}</p>
          : <TrendChart data={data.series} metric={metric} />}
      </Card>

      {/* ── Wpływ Caffenacci (dokładne dane z systemu) ── */}
      <div className="an-section-title">{t('analytics.impact.title')} <span>{t('analytics.impact.period', { days })}</span></div>
      <div className="an-kpis">
        <Kpi icon={<Gift size={16} />} label={t('analytics.kpi.scanned')} value={nf.format(imp.loyalty.scanned_period)}
             hint={t('analytics.kpi.scanned.hint')}>
          <span>{t('analytics.kpi.scanned.foot', { new: nf.format(imp.loyalty.new_in_period), returning: nf.format(imp.loyalty.returning_in_period) })}</span>
        </Kpi>
        <Kpi icon={<Users size={16} />} label={t('analytics.kpi.scannedTotal')} value={nf.format(imp.loyalty.scanned_total)}
             hint={t('analytics.kpi.scannedTotal.hint')}>
          <span>{t('analytics.kpi.transactions', { count: imp.loyalty.transactions })}</span>
        </Kpi>
        <Kpi icon={<ShoppingCart size={16} />} label={t('analytics.kpi.orders')} value={nf.format(imp.orders.placed)}>
          <span>{t('analytics.kpi.orders.foot', { completed: nf.format(imp.orders.completed), revenue: moneyBy(imp.orders.revenue_by_currency) })}</span>
        </Kpi>
        <Kpi icon={<CalendarDays size={16} />} label={t('analytics.kpi.reservations')} value={nf.format(imp.reservations.total)}>
          <span>{t('analytics.kpi.reservations.foot', { count: nf.format(imp.reservations.confirmed) })}</span>
        </Kpi>
        <Kpi icon={<Star size={16} />} label={t('analytics.kpi.reviews')} value={nf.format(imp.reviews.count)}>
          <span>{imp.reviews.average !== null ? t('analytics.kpi.reviews.avg', { avg: imp.reviews.average.toFixed(1) }) : t('analytics.kpi.reviews.none')}</span>
        </Kpi>
        <Kpi icon={<MousePointerClick size={16} />} label={t('analytics.kpi.contact')}
             value={nf.format(eventTotal('phone_click') + eventTotal('email_click') + eventTotal('map_click'))}>
          <span>{t('analytics.kpi.contact.foot')}</span>
        </Kpi>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        <Card icon={<Compass size={18} />} title={t('analytics.card.sources')}><BarList items={sourceItems} /></Card>
        <Card icon={<MousePointerClick size={18} />} title={t('analytics.card.actions')}><BarList items={clickItems} total={undefined} /></Card>
        <Card icon={<ShoppingCart size={18} />} title={t('analytics.card.funnel')}>
          <BarList items={funnel} total={funnel[0].value} />
          <p className="an-note">{t('analytics.funnel.note')}</p>
        </Card>
        <Card icon={<Users size={18} />} title={t('analytics.card.devices')}><BarList items={deviceItems} /></Card>
      </div>

      {data.share_url && (
        <Card icon={<QrCode size={18} />} title={t('analytics.share.title')}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '-0.25rem', lineHeight: 1.6 }}>
            {t('analytics.share.text1')} <code>src=qr</code> {t('analytics.share.text2')} <code>flyer</code>, <code>nfc</code>, <code>newsletter</code> {t('analytics.share.or')} <code>social</code>.
          </p>
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <code className="an-link" translate="no">{data.share_url}</code>
            <button type="button" className="btn btn--outline-dark btn--sm" style={{ width: 'auto', display: 'inline-flex', gap: '0.4rem' }} onClick={copyLink}>
              {copied ? <><Check size={14} /> {t('analytics.copied')}</> : <><Copy size={14} /> {t('analytics.copy')}</>}
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
