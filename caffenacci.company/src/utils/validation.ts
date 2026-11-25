// Lustro backend/app/core/validators.py — zmieniasz tu, zmień tam.

export const PASSWORD_RULES = ['length', 'lower', 'upper', 'digit', 'special'] as const
export type PasswordRule = (typeof PASSWORD_RULES)[number]
export const PASSWORD_MIN = 8
export const PASSWORD_MAX_BYTES = 72

export function checkPassword(pw: string): Record<PasswordRule, boolean> {
  return {
    length: [...pw].length >= PASSWORD_MIN,
    lower: /\p{Ll}/u.test(pw),
    upper: /\p{Lu}/u.test(pw),
    digit: /\p{Nd}/u.test(pw),
    special: /[^\p{L}\p{N}\s]/u.test(pw),
  }
}
export const isPasswordValid = (pw: string) => {
  const c = checkPassword(pw)
  return PASSWORD_RULES.every(r => c[r])
}
export const isPasswordTooLong = (pw: string) => new TextEncoder().encode(pw).length > PASSWORD_MAX_BYTES

export const normalizeSpaces = (s: string) => s.trim().replace(/\s+/g, ' ')

export const isValidEmail = (email: string) =>
  email.length <= 254 && /^[^\s@]{1,64}@([^\s@.]+\.)+[^\s@.]{2,}$/.test(email)

export const isValidNick = (n: string) =>
  n.length >= 3 && n.length <= 40 && /^[\p{L}\p{N}._]+$/u.test(n) && /[\p{L}\p{N}]/u.test(n)

// ── Tylko panel właściciela (w customer można pominąć) ──
export const isValidOwnerName = (v: string) => v.length >= 2 && v.length <= 100 && /^\p{L}[\p{L}\p{M} .'’-]*$/u.test(v)
export const isValidCafeName = (v: string) => v.length >= 2 && v.length <= 150 && /[\p{L}\p{N}]/u.test(v)
export const isValidStreet = (v: string) => v.length >= 2 && v.length <= 150 && /\p{L}/u.test(v)
export const isValidBuildingNumber = (v: string) => v.length <= 20 && /^[\p{L}\p{N}][\p{L}\p{N} ./-]*$/u.test(v)
export const isValidPostalCode = (v: string) => /^[A-Za-z0-9][A-Za-z0-9 -]{1,18}[A-Za-z0-9]$/.test(v)
export const isValidCity = (v: string) => v.length >= 2 && v.length <= 100 && /^\p{L}[\p{L}\p{M} .'’()-]*$/u.test(v)
export const isValidCountry = (v: string) => v.length >= 2 && v.length <= 100 && /\p{L}/u.test(v)