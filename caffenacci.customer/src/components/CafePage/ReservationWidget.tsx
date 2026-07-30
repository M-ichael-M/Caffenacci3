import SimpleReservationForm from './SimpleReservationForm'
import AdvancedReservationForm from './AdvancedReservationForm'
import { CalendarIcon } from './icons'

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

  // Dwa całkowicie niezależne mechanizmy — bez wspólnego formularza ani statusu.
  if (mode === 'advanced') {
    return <AdvancedReservationForm cafeId={cafeId} requireLogin={requireLogin} authToken={authToken} previewMode={previewMode} />
  }

  return <SimpleReservationForm cafeId={cafeId} requireLogin={requireLogin} authToken={authToken} previewMode={previewMode} />
}