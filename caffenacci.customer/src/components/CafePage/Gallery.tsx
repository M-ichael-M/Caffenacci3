import { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import ResponsiveImage, { imageUrl } from '../ResponsiveImage'
import { useI18n } from '../../i18n/I18nProvider'

interface GalleryImageItem {
  url: string
  width?: number | null
  height?: number | null
}

interface Props {
  images: GalleryImageItem[]
}

export default function Gallery({ images }: Props) {
  const { t } = useI18n()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (images.length === 0) return null

  const close = () => setLightboxIndex(null)

  const showPrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLightboxIndex(i => (i === null ? null : (i - 1 + images.length) % images.length))
  }

  const showNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLightboxIndex(i => (i === null ? null : (i + 1) % images.length))
  }

  return (
    <>
      <div className="cp-gallery">
        <div className="cp-gallery__track">
          {images.map((img, i) => (
            <div
              key={img.url + i}
              className="cp-gallery__item"
              onClick={() => setLightboxIndex(i)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setLightboxIndex(i) }}
            >
              <ResponsiveImage
                src={img.url}
                alt={t('gallery.alt', { n: i + 1 })}
                sizes="(max-width: 700px) 200px, 260px"
                width={img.width}
                height={img.height}
              />
            </div>
          ))}
        </div>
      </div>

      {lightboxIndex !== null && (
        <div className="cp-lightbox" onClick={close}>
          <button type="button" className="cp-lightbox__close" onClick={close} aria-label={t('common.close')}>
            <X size={20} />
          </button>

          {images.length > 1 && (
            <button
              type="button"
              className="cp-lightbox__nav cp-lightbox__nav--prev"
              onClick={showPrev}
              aria-label={t('gallery.prev')}
            >
              <ChevronLeft size={26} />
            </button>
          )}

          <img
            className="cp-lightbox__image"
            src={imageUrl(images[lightboxIndex].url, 1600)}
            width={images[lightboxIndex].width ?? undefined}
            height={images[lightboxIndex].height ?? undefined}
            alt={t('gallery.alt_big', { n: lightboxIndex + 1 })}
            onClick={e => e.stopPropagation()}
          />

          {images.length > 1 && (
            <button
              type="button"
              className="cp-lightbox__nav cp-lightbox__nav--next"
              onClick={showNext}
              aria-label={t('gallery.next')}
            >
              <ChevronRight size={26} />
            </button>
          )}
        </div>
      )}
    </>
  )
}