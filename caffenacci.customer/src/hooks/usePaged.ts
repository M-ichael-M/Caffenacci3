import { useCallback, useEffect, useRef, useState } from 'react'

export interface Page<T> { items: T[]; hasMore: boolean }

/** Lista ładowana porcjami. Pierwsza strona startuje, gdy `enabled`; kolejne po `more()`. */
export function usePaged<T extends { id: string }>(
  load: (offset: number, limit: number) => Promise<Page<T> | null>,
  enabled: boolean,
  pageSize = 30,
) {
  const [items, setItems] = useState<T[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const req = useRef(0)
  const loadRef = useRef(load); loadRef.current = load
  const itemsRef = useRef(items); itemsRef.current = items

  const reload = useCallback(async () => {
    const id = ++req.current
    setLoading(true)
    try {
      const r = await loadRef.current(0, pageSize)
      if (id !== req.current) return
      if (r) { setItems(r.items); setHasMore(r.hasMore) }
    } finally {
      if (id === req.current) { setLoading(false); setLoaded(true) }
    }
  }, [pageSize])

  const more = useCallback(async () => {
    if (loading || loadingMore) return
    const id = req.current
    setLoadingMore(true)
    try {
      const r = await loadRef.current(itemsRef.current.length, pageSize)
      if (id !== req.current || !r) return
      // dedupe po id: nowy wpis na początku przesuwa offset
      setItems(prev => {
        const seen = new Set(prev.map(x => x.id))
        return [...prev, ...r.items.filter(x => !seen.has(x.id))]
      })
      setHasMore(r.hasMore)
    } finally {
      setLoadingMore(false)
    }
  }, [loading, loadingMore, pageSize])

  /** Unieważnia dane — kolejne wejście w zakładkę pobierze świeżą pierwszą stronę. */
  const invalidate = useCallback(() => {
    req.current++
    setItems([]); setHasMore(false); setLoaded(false); setLoading(false); setLoadingMore(false)
  }, [])

  useEffect(() => { if (enabled && !loaded) void reload() }, [enabled, loaded, reload])

  return { items, hasMore, loading, loadingMore, loaded, reload, more, invalidate }
}