import { currencyExponent, roundMoney } from './currency'

/** Lustro backend/app/core/loyalty_rules.py: floor(kwota * P / N), na liczbach całkowitych (jednostki podrzędne). */
export function computePoints(amount: number, currency: string, points: number, unit: number): number {
  const f = 10 ** currencyExponent(currency)
  const minor = Math.round(roundMoney(amount, currency) * f)
  return Math.floor((minor * points) / (unit * f))
}