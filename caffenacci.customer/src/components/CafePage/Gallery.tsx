interface GalleryImageItem {
  url: string
}

interface Props {
  images: GalleryImageItem[]
}

// Jeden, wspólny markup dla wszystkich motywów — to CSS w cafePage.css
// (per `.cafe-page--{template} .cp-gallery`) decyduje, czy zdjęcia
// przewijają się w pasku, układają w siatkę, czy "unoszą się" poza
// treścią strony (motyw magic).
export default function Gallery({ images }: Props) {
  if (images.length === 0) return null

  return (
    <div className="cp-gallery">
      <div className="cp-gallery__track">
        {images.map((img, i) => (
          <div key={img.url + i} className="cp-gallery__item">
            <img src={`http://localhost:8000${img.url}`} alt={`Zdjęcie z galerii ${i + 1}`} loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  )
}