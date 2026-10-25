import { API_URL } from '../config'
export function thumbUrl(path: string, w: number): string {
  const full = `${API_URL}${path}`
  return `${full}${full.includes('?') ? '&' : '?'}w=${w}`
}