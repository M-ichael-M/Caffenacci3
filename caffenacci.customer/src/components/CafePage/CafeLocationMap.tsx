import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

interface Props {
  latitude: number
  longitude: number
}

// Ten sam darmowy, komercyjnie bezpieczny styl co w panelu właściciela.
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

export default function CafeLocationMap({ latitude, longitude }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Kolor pinezki dopasowany do aktualnej palety kawiarni (--gold).
    const goldColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--gold').trim() || '#A9722F'

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [longitude, latitude],
      zoom: 15,
      // Scroll po stronie nie „porywa" kółka myszy — trzeba przytrzymać Ctrl.
      cooperativeGestures: true,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    new maplibregl.Marker({ color: goldColor }).setLngLat([longitude, latitude]).addTo(map)

    return () => map.remove()
  }, [latitude, longitude])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}