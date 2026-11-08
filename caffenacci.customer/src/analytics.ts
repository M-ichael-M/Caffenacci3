import { API_URL } from './config'

// Bez cookies, localStorage i sessionStorage — nic nie zapisujemy na urządzeniu.
// Szanujemy DNT / Global Privacy Control.
function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true
}

function send(payload: Record<string, string | undefined>) {
  if (optedOut()) return
  const body = JSON.stringify(payload)
  const url = `${API_URL}/analytics/collect`
  try {
    // text/plain => "prosty" request, bez preflightu CORS
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) return
  } catch { /* spadamy do fetch */ }
  fetch(url, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {})
}

let lastPv = { id: '', at: 0 }

export function trackPageview(cafeId: string) {
  if (lastPv.id === cafeId && Date.now() - lastPv.at < 1500) return   // StrictMode / podwójny efekt
  lastPv = { id: cafeId, at: Date.now() }
  let ref: string | undefined
  try { ref = document.referrer ? new URL(document.referrer).origin : undefined } catch { /* ignoruj */ }
  const src = new URLSearchParams(window.location.search).get('src') ?? undefined
  send({ cafe_id: cafeId, type: 'pageview', ref, src })
}

export function trackEvent(cafeId: string, name: string, dim?: string) {
  send({ cafe_id: cafeId, type: 'event', name, dim })
}
