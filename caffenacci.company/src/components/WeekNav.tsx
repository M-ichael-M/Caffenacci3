import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '../i18n'
import type { Week } from '../hooks/useWeek'

export default function WeekNav({ week }: { week: Week }) {
  const { t, locale } = useI18n()
  const d = (ymd: string, o: Intl.DateTimeFormatOptions) =>
    new Date(ymd + 'T00:00:00').toLocaleDateString(locale, o)
  return (
    <div className="res-day-nav">
      <button type="button" className="res-day-nav__btn" onClick={week.prev}
        aria-label={t('week.prev')} title={t('week.prev')}><ChevronLeft size={18} /></button>
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
          {d(week.start, { day: 'numeric', month: 'short' })} – {d(week.end, { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
        {!week.isCurrent && (
          <button type="button" className="link-btn" style={{ fontSize: '0.8125rem' }} onClick={week.reset}>
            {t('week.current')}
          </button>
        )}
      </div>
      <button type="button" className="res-day-nav__btn" onClick={week.next}
        aria-label={t('week.next')} title={t('week.next')}><ChevronRight size={18} /></button>
    </div>
  )
}