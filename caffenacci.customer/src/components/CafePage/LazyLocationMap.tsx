import { lazy, Suspense } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import LazyOnVisible from '../LazyOnVisible'

// maplibre-gl i jego CSS importuje WYŁĄCZNIE CafeLocationMap → trafiają do lazy chunku
const CafeLocationMap = lazy(() => import('./CafeLocationMap'))

function MapPlaceholder({ address, gmapsUrl }: { address: string; gmapsUrl: string | null }) {
  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '0.5rem', padding: '1rem', textAlign: 'center',
      background: 'rgba(128,128,128,0.08)', border: '1px dashed var(--border)',
      borderRadius: 8, color: 'inherit', fontSize: '0.8125rem',
    }}>
      <MapPin size={20} style={{ color: 'var(--gold)' }} />
      <span>{address}</span>
      {gmapsUrl && (
        <a href={gmapsUrl} target="_blank" rel="noreferrer" className="link"
           style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          Otwórz w Google Maps <ExternalLink size={13} />
        </a>
      )}
    </div>
  )
}

interface Props { latitude: number; longitude: number; address: string; gmapsUrl: string | null }

export default function LazyLocationMap({ latitude, longitude, address, gmapsUrl }: Props) {
  const placeholder = <MapPlaceholder address={address} gmapsUrl={gmapsUrl} />
  return (
    <LazyOnVisible placeholder={placeholder} style={{ width: '100%', height: '100%' }}>
      <Suspense fallback={placeholder}>
        <CafeLocationMap latitude={latitude} longitude={longitude} />
      </Suspense>
    </LazyOnVisible>
  )
}