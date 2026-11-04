import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface Props {
  children: ReactNode
  placeholder: ReactNode
  rootMargin?: string
  style?: CSSProperties
}

/** Renderuje `children` dopiero, gdy kontener jest ~rootMargin przed viewportem. */
export default function LazyOnVisible({ children, placeholder, rootMargin = '200px', style }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect() }
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [visible, rootMargin])

  return <div ref={ref} style={style}>{visible ? children : placeholder}</div>
}