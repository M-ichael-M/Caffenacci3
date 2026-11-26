import { useState } from 'react'
import { useCafeSettings } from '../components/CafeSettingsContext'
import { addDays, dowOf, todayInTz } from '../utils/cafeTime'

export function useWeek() {
  const { timeZone } = useCafeSettings()
  const [picked, setPicked] = useState<string | null>(null)
  const current = addDays(todayInTz(timeZone), -dowOf(todayInTz(timeZone)))
  const start = picked ?? current
  return {
    start,
    end: addDays(start, 6),
    isCurrent: start === current,
    prev: () => setPicked(addDays(start, -7)),
    next: () => setPicked(addDays(start, 7)),
    reset: () => setPicked(null),
    contains: (ymd: string) => ymd >= start && ymd <= addDays(start, 6),
  }
}
export type Week = ReturnType<typeof useWeek>