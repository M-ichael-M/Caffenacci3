import { detailMessages } from '../utils/apiDetail'
import type { TFunction } from './system'

// Polski komunikat z backendu → klucz słownika (system/pl.json, system/en.json).
const API_ERRORS: Record<string, string> = {
  'Nieprawidłowy email lub hasło.': 'api.invalid_credentials',
  'Konto z podanym adresem email już istnieje.': 'api.email_taken',
  'Konto z podanym adresem email lub nickiem już istnieje.': 'api.account_exists',
  'Ten nick jest już zajęty. Wybierz inny.': 'api.nick_taken',
  'Nick musi mieć od 3 do 40 znaków.': 'api.nick_length',
  'Nick może zawierać tylko litery, cyfry, kropki i podkreślenia.': 'api.nick_chars',
  'Imię i nazwisko musi mieć od 2 do 150 znaków.': 'api.full_name',
  'Podaj prawidłowy adres e-mail.': 'api.email_invalid',
  'Podaj numer telefonu w formacie międzynarodowym, np. +48123456789.': 'api.phone',
  'Hasło musi mieć co najmniej 8 znaków, wielką i małą literę, cyfrę oraz znak specjalny.': 'api.password_weak',
  'Hasło jest zbyt długie (maksymalnie 72 bajty).': 'api.password_long',
  'Hasła nie są identyczne.': 'api.password_mismatch',
  'Akceptacja regulaminu jest wymagana.': 'api.terms',
  'Akceptacja polityki prywatności jest wymagana.': 'api.privacy',
}

/** Tłumaczy `detail` z API (string albo tablica 422) na język bieżącego słownika. */
export function apiErrorText(detail: unknown, t: TFunction, fallbackKey: string): string {
  const msgs = detailMessages(detail)
  if (msgs.length === 0) return t(fallbackKey)
  return msgs.map(m => (API_ERRORS[m] ? t(API_ERRORS[m]) : m)).join(' ')
}