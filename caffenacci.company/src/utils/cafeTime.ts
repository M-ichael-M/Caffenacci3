const FALLBACK_TZ = 'Europe/Warsaw'
const fmtCache = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz)
  if (!f) {
    const make = (z: string) => new Intl.DateTimeFormat('en-CA', {
      timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
    try { f = make(tz) } catch { f = make(FALLBACK_TZ) }
    fmtCache.set(tz, f)
  }
  return f
}

function parts(ts: number, tz: string) {
  const o: Record<string, number> = {}
  for (const p of formatter(tz).formatToParts(ts)) if (p.type !== 'literal') o[p.type] = Number(p.value)
  return o as { year: number; month: number; day: number; hour: number; minute: number }
}

const pad = (n: number) => String(n).padStart(2, '0')
const ymdParts = (ymd: string) => ymd.split('-').map(Number) as [number, number, number]

export const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const fromMinutes = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`

/** „Teraz” w strefie kawiarni: data (YYYY-MM-DD) i minuty od północy. */
export function nowInTz(tz: string, ts = Date.now()) {
  const p = parts(ts, tz)
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, minutes: p.hour * 60 + p.minute }
}
export const todayInTz = (tz: string) => nowInTz(tz).date

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymdParts(ymd)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}
/** 0 = poniedziałek (jak w backendzie) */
export function dowOf(ymd: string): number {
  const [y, m, d] = ymdParts(ymd)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

function offsetMs(ts: number, tz: string): number {
  const p = parts(ts, tz)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ts / 60000) * 60000
}

/** Epoch (ms) chwili, w której na ścianie kawiarni jest `ymd hh:mm`. */
export function wallToEpoch(ymd: string, hhmm: string, tz: string): number {
  const [y, m, d] = ymdParts(ymd)
  const [h, mi] = hhmm.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  const t = guess - offsetMs(guess, tz)
  return guess - offsetMs(t, tz)
}

export function offsetLabel(tz: string): string {
  const mins = Math.round(offsetMs(Date.now(), tz) / 60000)
  const sign = mins < 0 ? '−' : '+'
  const a = Math.abs(mins)
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? ':' + pad(a % 60) : ''}`
}
/** Czy zegar gościa różni się od zegara kawiarni (wtedy pokazujemy dopisek). */
export const differsFromBrowser = (tz: string) =>
  offsetMs(Date.now(), tz) !== -new Date().getTimezoneOffset() * 60000

/** created_at z API to UTC bez 'Z'. */
export const parseUtc = (iso: string) =>
  new Date(/([zZ]|[+-]\d\d:?\d\d)$/.test(iso) ? iso : `${iso}Z`)

// ── Godziny otwarcia (zgodne z backendowym sessions_for) ───────────────────
export type HoursFn = (ymd: string) => { open: string | null; close: string | null }

export function hoursOn(
  weekly: { day_of_week: number; open_time: string | null; close_time: string | null }[],
  exceptions: { date: string; is_closed: boolean; open_time: string | null; close_time: string | null }[],
): HoursFn {
  return ymd => {
    const e = exceptions.find(x => x.date === ymd)
    if (e) return e.is_closed ? { open: null, close: null } : { open: e.open_time, close: e.close_time }
    const p = weekly.find(h => h.day_of_week === dowOf(ymd))
    return { open: p?.open_time ?? null, close: p?.close_time ?? null }
  }
}

const toSession = (h: { open: string | null; close: string | null }, off: number): [number, number] | null => {
  if (!h.open || !h.close) return null
  const o = toMinutes(h.open)
  let c = toMinutes(h.close)
  if (c <= o) c += 1440
  return [o + off * 1440, c + off * 1440]
}

/** Sesje dotykające dnia `ymd`, w minutach od jego północy (ogon wczorajszej ma początek < 0). */
export function sessionsFor(ymd: string, hours: HoursFn): [number, number][] {
  const out: [number, number][] = []
  const prev = toSession(hours(addDays(ymd, -1)), -1)
  if (prev && prev[1] > 0) out.push(prev)
  const cur = toSession(hours(ymd), 0)
  if (cur) out.push(cur)
  return out
}