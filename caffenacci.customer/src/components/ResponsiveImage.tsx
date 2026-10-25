import type { CSSProperties } from 'react'
import { API_URL } from '../config'

export const IMAGE_WIDTHS = {
  gallery: [480, 960, 1600],
  logo: [128, 256, 512],
} as const

/** path z API (z ?v=…) + opcjonalnie &w=… */
export function imageUrl(path: string, w?: number): string {
  const full = `${API_URL}${path}`
  return w ? `${full}${full.includes('?') ? '&' : '?'}w=${w}` : full
}

interface Props {
  src: string
  alt: string
  sizes: string
  widths?: readonly number[]
  width?: number | null
  height?: number | null
  priority?: boolean      // eager + fetchpriority=high (logo w hero)
  className?: string
  style?: CSSProperties
}

export default function ResponsiveImage({
  src, alt, sizes, widths = IMAGE_WIDTHS.gallery,
  width, height, priority = false, className, style,
}: Props) {
  const srcSet = widths.map(w => `${imageUrl(src, w)} ${w}w`).join(', ')
  const fallback = imageUrl(src, widths[Math.min(1, widths.length - 1)])
  return (
    <img
      className={className}
      style={style}
      src={fallback}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width ?? undefined}
      height={height ?? undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...(priority ? { fetchPriority: 'high' as const } : {})}
    />
  )
}