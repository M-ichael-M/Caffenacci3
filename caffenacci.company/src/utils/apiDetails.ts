// Spłaszcza `detail` z FastAPI (string albo tablica błędów 422) do listy komunikatów.
const EMAIL_MSG = 'Podaj prawidłowy adres e-mail.'

interface Item { type?: string; msg?: string; loc?: unknown[] }

export function detailMessages(detail: unknown): string[] {
  if (typeof detail === 'string') return detail.trim() ? [detail] : []
  if (!Array.isArray(detail)) return []
  const out: string[] = []
  for (const raw of detail as Item[]) {
    if (!raw || typeof raw !== 'object') continue
    if (raw.loc?.includes('email')) { out.push(EMAIL_MSG); continue }
    // komunikaty z naszych walidatorów (ValueError) — wbudowane błędy pydantic pomijamy
    if (raw.type === 'value_error' && typeof raw.msg === 'string') {
      out.push(raw.msg.replace(/^Value error, /, ''))
    }
  }
  return [...new Set(out)]
}