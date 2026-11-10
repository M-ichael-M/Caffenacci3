import type { ComponentType } from 'react'
import {
  PawPrint, Cat, Users, Laptop, Heart, Wifi, Dices, Gamepad2, Plug, Coffee, Zap,
  Music, Palette, Mic2, BookOpen, Trees, Wind, Accessibility, ParkingCircle, Bike, BadgeAlert,
} from 'lucide-react'

// Katalog plakietek kawiarni — klucze muszą być zsynchronizowane z
// backend/app/schemas/badges.py. Etykiety i opisy w dymkach pochodzą ze
// słowników i18n: `badge.<key>` oraz (gdy hasInfo) `badge.<key>.info`.

export interface BadgeIconProps {
  size?: number
  className?: string
}

export interface BadgeDefinition {
  key: string
  /** Czy istnieje klucz `badge.<key>.info` z krótkim wyjaśnieniem w dymku. */
  hasInfo?: boolean
  icon: ComponentType<BadgeIconProps>
}

export const MAX_FEATURED_BADGES = 3

export const BADGE_CATALOG: BadgeDefinition[] = [
  { key: 'pet_friendly', hasInfo: true, icon: PawPrint },
  { key: 'animal_cafe', hasInfo: true, icon: Cat },
  { key: 'family_friendly', icon: Users },
  { key: 'work_friendly', icon: Laptop },
  { key: 'date_spot', icon: Heart },
  { key: 'free_wifi', icon: Wifi },
  { key: 'board_games', icon: Dices },
  { key: 'video_games', icon: Gamepad2 },
  { key: 'power_outlets', icon: Plug },
  { key: 'specialty_coffee', icon: Coffee },
  { key: 'fast_service', icon: Zap },
  { key: 'live_music', icon: Music },
  { key: 'extra_activities', hasInfo: true, icon: Palette },
  { key: 'karaoke', icon: Mic2 },
  { key: 'bookshelf', icon: BookOpen },
  { key: 'garden', icon: Trees },
  { key: 'air_conditioning', icon: Wind },
  { key: 'accessible', hasInfo: true, icon: Accessibility },
  { key: 'parking', icon: ParkingCircle },
  { key: 'bike_rack', icon: Bike },
  { key: 'adults_only', hasInfo: true, icon: BadgeAlert },
]

export const BADGE_MAP: Record<string, BadgeDefinition> = Object.fromEntries(
  BADGE_CATALOG.map(b => [b.key, b]),
)