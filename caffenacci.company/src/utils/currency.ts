// Tabela musi być identyczna z backend/app/core/currency.py (EXPONENT_OVERRIDES).
const EXPONENT_OVERRIDES: Record<string, number> = { ISK: 0, JPY: 0, KRW: 0, VND: 0, CLP: 0 }

export const currencyExponent = (code?: string | null): number =>
  EXPONENT_OVERRIDES[(code ?? '').toUpperCase()] ?? 2

export function roundMoney(v: number, code?: string | null): number {
  const f = 10 ** currencyExponent(code)
  return Math.round((v + Number.EPSILON) * f) / f
}

const cache = new Map<string, Intl.NumberFormat>()

/** Zawsze dokładnie tyle miejsc po przecinku, ile ma waluta (zgodnie z zaokrąglaniem na backendzie). */
export function formatMoney(v: number, locale: string, code: string): string {
  const d = currencyExponent(code)
  const key = `${locale}|${code}`
  try {
    let f = cache.get(key)
    if (!f) {
      f = new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: d, maximumFractionDigits: d })
      cache.set(key, f)
    }
    return f.format(v)
  } catch {
    return `${v.toFixed(d)} ${code}`
  }
}