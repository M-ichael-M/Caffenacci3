export type Dict = Record<string, string>
export interface SystemDicts { dict: Dict; en: Dict }
export type Params = Record<string, string | number>
export interface TFunction { (key: string, params?: Params): string; has(key: string): boolean }

const modules = import.meta.glob<{ default: Dict }>('./system/*.json')
// Napisy panelu gościa / wyszukiwarki (poza stronami kawiarni)
const appModules = import.meta.glob<{ default: Dict }>('./app/*.json')
const cache = new Map<string, Promise<SystemDicts>>()

function pick(mods: Record<string, () => Promise<{ default: Dict }>>, dir: string, code: string) {
  const lc = code.toLowerCase()
  return mods[`./${dir}/${code}.json`] ?? mods[`./${dir}/${lc}.json`] ?? mods[`./${dir}/${lc.split('-')[0]}.json`] ?? null
}

export function loadSystem(code: string): Promise<SystemDicts> {
  let p = cache.get(code)
  if (!p) {
    p = Promise.all([
      pick(modules, 'system', code)?.(),
      modules['./system/en.json'](),
      pick(appModules, 'app', code)?.(),
      appModules['./app/en.json']?.(),
    ]).then(([m, e, a, ae]) => ({
      dict: { ...(m?.default ?? {}), ...(a?.default ?? {}) },
      en: { ...e.default, ...(ae?.default ?? {}) },
    }))
    cache.set(code, p)
  }
  return p
}

/** Łańcuch: wybrany język → en → sam klucz. W RTL wartości parametrów są izolowane (FSI/PDI). */
export function makeT(locale: string, dir: 'ltr' | 'rtl', { dict, en }: SystemDicts): TFunction {
  let pr: Intl.PluralRules, nf: Intl.NumberFormat
  try { pr = new Intl.PluralRules(locale); nf = new Intl.NumberFormat(locale) }
  catch { pr = new Intl.PluralRules('en'); nf = new Intl.NumberFormat('en') }
  const enPr = new Intl.PluralRules('en')

  const pick = (d: Dict, key: string, count: number | undefined, rules: Intl.PluralRules) =>
    count === undefined ? d[key] : (d[`${key}_${rules.select(count)}`] ?? d[`${key}_other`] ?? d[key])

  const t = ((key: string, params?: Params) => {
    const count = typeof params?.count === 'number' ? params.count : undefined
    const s = pick(dict, key, count, pr) ?? pick(en, key, count, enPr) ?? key
    if (!params) return s
    return s.replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in params)) return m
      const v = params[k]
      const txt = k === 'count' && typeof v === 'number' ? nf.format(v) : String(v)
      return dir === 'rtl' ? `\u2068${txt}\u2069` : txt
    })
  }) as TFunction
  t.has = key => key in dict || key in en
  return t
}
