import { useEffect } from 'react'

/** Removes the static SEO content after the real React page is mounted. */
export default function SeoHandoff() {
  useEffect(() => {
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        document.querySelector('#root > .seo-content')?.remove()
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      if (secondFrame) cancelAnimationFrame(secondFrame)
    }
  }, [])
  return null
}
