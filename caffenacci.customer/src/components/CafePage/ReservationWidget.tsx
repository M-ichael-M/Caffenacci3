import { lazy, Suspense } from 'react'
import { CalendarIcon } from './icons'

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
  if (!enabled) {
    return (
      <div className="res-empty-card">
        <div className="res-empty-icon"><CalendarIcon size={34} /></div>
        <div className="res-empty-title">Rezerwacje online niedostępne</div>
        <div className="res-empty-sub">Ta kawiarnia nie przyjmuje obecnie rezerwacji online.</div>
      </div>
    )
  }

  const formProps = { cafeId, requireLogin, authToken, previewMode }
  return (
    <Suspense fallback={<p className="cp-muted-note" style={{ minHeight: 44 }}>Ładowanie formularza…</p>}>
      {mode === 'advanced' ? <AdvancedReservationForm {...formProps} /> : <SimpleReservationForm {...formProps} />}
    </Suspense>
  )
}