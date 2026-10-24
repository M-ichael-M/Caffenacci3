// Jeśli SPA dostało dane z /site/public/by-slug/{slug} z INNYM slugiem niż w URL
// (wejście starym linkiem), podmień adres bez przeładowania i bez wpisu w historii.
export function syncCafeSlugInUrl(currentSlug: string | null | undefined) {
  if (!currentSlug) return
  const m = window.location.pathname.match(/^\/(kawiarnia|cafe)\/([^/]+)(\/.*)?$/)
  if (!m) return // np. /preview/... — nie ruszamy
  const urlSlug = decodeURIComponent(m[2])
  if (m[1] === 'kawiarnia' && urlSlug === currentSlug) return
  window.history.replaceState(
    window.history.state,
    '',
    `/kawiarnia/${encodeURIComponent(currentSlug)}${m[3] ?? ''}${window.location.search}${window.location.hash}`,
  )
}