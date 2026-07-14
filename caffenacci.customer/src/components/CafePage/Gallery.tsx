import { useState } from 'react'

interface GalleryImageItem {
  url: string
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
              <img src={`http://localhost:8000${img.url}`} alt={`Zdjęcie z galerii ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      </div>

      {lightboxIndex !== null && (
        <div className="cp-lightbox" onClick={close}>
          <button type="button" className="cp-lightbox__close" onClick={close} aria-label="Zamknij">✕</button>

          {images.length > 1 && (
            <button type="button" className="cp-lightbox__nav cp-lightbox__nav--prev" onClick={showPrev} aria-label="Poprzednie zdjęcie">‹</button>
          )}

          <img
            className="cp-lightbox__image"
            src={`http://localhost:8000${images[lightboxIndex].url}`}
            alt={`Powiększone zdjęcie z galerii ${lightboxIndex + 1}`}
            onClick={e => e.stopPropagation()}
          />

          {images.length > 1 && (
            <button type="button" className="cp-lightbox__nav cp-lightbox__nav--next" onClick={showNext} aria-label="Następne zdjęcie">›</button>
          )}
        </div>
      )}
    </>
  )
}