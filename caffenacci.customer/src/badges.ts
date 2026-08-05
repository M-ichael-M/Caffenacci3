import type { ComponentType } from 'react'
import {
  PawPrint,
  Cat,
  Users,
  Laptop,
  Heart,
  Wifi,
  Dices,
  Gamepad2,
  Plug,
  Coffee,
  Zap,
  Music,
  Palette,
  Mic2,
  BookOpen,
  Trees,
  Wind,
  Accessibility,
  ParkingCircle,
  Bike,
  BadgeAlert,
} from 'lucide-react'

// Katalog plakietek kawiarni — klucze muszą być zsynchronizowane z
// backend/app/schemas/badges.py (tam trzymany jest wyłącznie zbiór
// dozwolonych kluczy do walidacji; etykiety/ikony/opisy żyją tutaj oraz
// w caffenacci.customer/src/badges.ts, żeby wyniki wyszukiwania mogły
// wyrenderować plakietkę bez dodatkowego zapytania do API).

export interface BadgeIconProps {
  size?: number
  className?: string
}

export interface BadgeDefinition {
  key: string
  label: string
  /** Krótkie wyjaśnienie pokazywane w dymku (title) obok niektórych plakietek. */
  info?: string
  icon: ComponentType<BadgeIconProps>
}

export const MAX_FEATURED_BADGES = 3

export const BADGE_CATALOG: BadgeDefinition[] = [
  { key: 'pet_friendly', label: 'Przyjazna zwierzętom', info: 'Możesz przyjść ze swoim psem lub kotem.', icon: PawPrint },
  { key: 'animal_cafe', label: 'Zwierzęca kawiarnia', info: 'W kawiarni na stałe mieszkają zwierzęta, np. koty.', icon: Cat },
  { key: 'family_friendly', label: 'Dla rodzin', icon: Users },
  { key: 'work_friendly', label: 'Idealna do pracy', icon: Laptop },
  { key: 'date_spot', label: 'Na randkę', icon: Heart },
  { key: 'free_wifi', label: 'Darmowe wifi', icon: Wifi },
  { key: 'board_games', label: 'Planszówki', icon: Dices },
  { key: 'video_games', label: 'Gry wideo', icon: Gamepad2 },
  { key: 'power_outlets', label: 'Gniazdka przy stolikach', icon: Plug },
  { key: 'specialty_coffee', label: 'Specialty coffee', icon: Coffee },
  { key: 'fast_service', label: 'Szybkie zamówienia', icon: Zap },
  { key: 'live_music', label: 'Muzyka na żywo', icon: Music },
  { key: 'extra_activities', label: 'Dodatkowe aktywności', info: 'np. malowanie ceramiki, warsztaty roślinne.', icon: Palette },
  { key: 'karaoke', label: 'Karaoke', icon: Mic2 },
  { key: 'bookshelf', label: 'Półka z książkami', icon: BookOpen },
  { key: 'garden', label: 'Ogródek', icon: Trees },
  { key: 'air_conditioning', label: 'Klimatyzacja', icon: Wind },
  { key: 'accessible', label: 'Przyjazna osobom z niepełnosprawnościami', info: 'Lokal dostosowany do potrzeb osób z niepełnosprawnościami.', icon: Accessibility },
  { key: 'parking', label: 'Parking', icon: ParkingCircle },
  { key: 'bike_rack', label: 'Stojak na rowery', icon: Bike },
  { key: 'adults_only', label: '18+', info: 'Miejsce przeznaczone wyłącznie dla osób pełnoletnich.', icon: BadgeAlert },
]

export const BADGE_MAP: Record<string, BadgeDefinition> = Object.fromEntries(
  BADGE_CATALOG.map(b => [b.key, b]),
)
