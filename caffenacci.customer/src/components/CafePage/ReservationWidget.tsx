import { lazy, Suspense } from 'react'
import { CalendarIcon } from './icons'
import { useI18n } from '../../i18n/I18nProvider'


const SimpleReservationForm   = lazy(() => import('./SimpleReservationForm'))
const AdvancedReservationForm = lazy(() => import('./AdvancedReservationForm'))

interface Props {
  cafeId: string
  enabled: boolean
  mode: string // 'simple' | 'advanced'
  requireLogin: (action: () => void) => void
  authToken: string | null
  previewMode?: boolean
}

export default function ReservationWidget({ cafeId, enabled, mode, requireLogin, authToken, previewMode = false }: Props) {
  const { t } = useI18n()

  if (!enabled) {
    return (
      <div className="res-empty-card">
        <div className="res-empty-icon"><CalendarIcon size={34} /></div>
        <div className="res-empty-title">{t('reservation.unavailable_title')}</div>
        <div className="res-empty-sub">{t('reservation.unavailable_sub')}</div>
      </div>
    )
  }

  const formProps = { cafeId, requireLogin, authToken, previewMode }
  return (
    <Suspense fallback={<p className="cp-muted-note" style={{ minHeight: 44 }}>{t('reservation.loading_form')}</p>}>
      {mode === 'advanced' ? <AdvancedReservationForm {...formProps} /> : <SimpleReservationForm {...formProps} />}
    </Suspense>
  )
}