import { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import ResponsiveImage, { imageUrl } from '../ResponsiveImage'

interface GalleryImageItem {
  url: string
  width?: number | null
  height?: number | null
}

interface Props {
  images: GalleryImageItem[]
}

export default function Gallery({ images }: Props) {
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
                alt={`Zdjęcie z galerii ${i + 1}`}
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
          <button type="button" className="cp-lightbox__close" onClick={close} aria-label="Zamknij"><X size={20} /></button>

          {images.length > 1 && (
            <button type="button" className="cp-lightbox__nav cp-lightbox__nav--prev" onClick={showPrev} aria-label="Poprzednie zdjęcie"><ChevronLeft size={26} /></button>
          )}

          <img
            className="cp-lightbox__image"
            src={imageUrl(images[lightboxIndex].url, 1600)}
            width={images[lightboxIndex].width ?? undefined}
            height={images[lightboxIndex].height ?? undefined}
            alt={`Powiększone zdjęcie z galerii ${lightboxIndex + 1}`}
            onClick={e => e.stopPropagation()}
          />

          {images.length > 1 && (
            <button type="button" className="cp-lightbox__nav cp-lightbox__nav--next" onClick={showNext} aria-label="Następne zdjęcie"><ChevronRight size={26} /></button>
          )}
        </div>
      )}
    </>
  )
}