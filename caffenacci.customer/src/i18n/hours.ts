import { formatDate, type LocaleFormat } from './localeFormat'
import type { TFunction } from './system'

export function exceptionSentence(
  e: { date: string; is_closed: boolean; open_time: string | null; close_time: string | null },
  t: TFunction, fmt: LocaleFormat,
) {
  const date = formatDate(e.date, fmt, { day: 'numeric', month: 'long' })
  if (e.is_closed || !e.open_time || !e.close_time) return t('hours.exception_closed', { date })
  return t('hours.exception_open', { date, open: e.open_time, close: e.close_time })
}