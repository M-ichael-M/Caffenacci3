import { useEffect, useRef, useState } from 'react'
import { X, ZoomIn, ZoomOut } from 'lucide-react'
import { useI18n } from '../i18n'

const VIEW = 288          // rozmiar pola kadrowania (px CSS)
const MAX_ZOOM = 4
const MIN_OUT = 512       // backend wymaga min. 512×512
const MAX_OUT = 1024

interface View { zoom: number; x: number; y: number }
interface Nat { w: number; h: number }

interface Props {
  file: File
  busy: boolean
  onCancel: () => void
  onConfirm: (blob: Blob) => void
}

const baseScale = (n: Nat) => VIEW / Math.min(n.w, n.h)   // „cover” przy zoomie 1

function clampView(v: View, n: Nat): View {
  const scale = baseScale(n) * v.zoom
  const mx = Math.max(0, (n.w * scale - VIEW) / 2)
  const my = Math.max(0, (n.h * scale - VIEW) / 2)
  return { zoom: v.zoom, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) }
}

/** Zmiana zoomu z zachowaniem środka kadru. */
function withZoom(v: View, zoom: number, n: Nat): View {
  const z = Math.min(MAX_ZOOM, Math.max(1, zoom))
  const r = z / v.zoom
  return clampView({ zoom: z, x: v.x * r, y: v.y * r }, n)
}

export default function LogoCropper({ file, busy, onCancel, onConfirm }: Props) {
  const { t } = useI18n()
  const [url, setUrl] = useState<string | null>(null)
  const [nat, setNat] = useState<Nat | null>(null)
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 })
  const [error, setError] = useState<string | null>(null)

  const imgRef = useRef<HTMLImageElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const natRef = useRef<Nat | null>(null)
  natRef.current = nat
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const lastDist = useRef<number | null>(null)

  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    setNat(null)
    setView({ zoom: 1, x: 0, y: 0 })
    return () => URL.revokeObjectURL(u)
  }, [file])

  // Zoom kółkiem — natywny listener (React robi onWheel jako passive)
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      const n = natRef.current
      if (!n) return
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.0015)
      setView(v => withZoom(v, v.zoom * factor, n))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    lastDist.current = null
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const n = natRef.current
    const prev = pointers.current.get(e.pointerId)
    if (!n || !prev) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      setView(v => clampView({ ...v, x: v.x + dx, y: v.y + dy }, n))
    } else if (pointers.current.size === 2) {          // pinch na telefonie
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (lastDist.current) {
        const factor = dist / lastDist.current
        setView(v => withZoom(v, v.zoom * factor, n))
      }
      lastDist.current = dist
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    lastDist.current = null
  }

  const setZoom = (z: number) => nat && setView(v => withZoom(v, z, nat))

  const handleConfirm = () => {
    const img = imgRef.current
    if (!img || !nat) return
    const scale = baseScale(nat) * view.zoom
    const size = VIEW / scale                                   // bok kadru w pikselach oryginału
    const sx = Math.min(nat.w - size, Math.max(0, (nat.w * scale / 2 - VIEW / 2 - view.x) / scale))
    const sy = Math.min(nat.h - size, Math.max(0, (nat.h * scale / 2 - VIEW / 2 - view.y) / scale))
    const out = Math.min(MAX_OUT, Math.max(MIN_OUT, Math.round(size)))

    const canvas = document.createElement('canvas')
    canvas.width = out
    canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) { setError(t('logoCrop.err.export')); return }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, sx, sy, size, size, 0, 0, out, out)
    canvas.toBlob(
      b => (b ? onConfirm(b) : setError(t('logoCrop.err.export'))),
      'image/png',                                              // PNG zachowuje przezroczystość logo
    )
  }

  const scale = nat ? baseScale(nat) * view.zoom : 1
  const dw = nat ? nat.w * scale : 0
  const dh = nat ? nat.h * scale : 0

  return (
    <div className="lc-overlay" onClick={e => { if (e.target === e.currentTarget && !busy) onCancel() }}>
      <div className="lc-modal" role="dialog" aria-modal="true" aria-label={t('logoCrop.title')}>
        <div className="lc-header">
          <div>
            <div className="lc-eyebrow">{t('logoCrop.eyebrow')}</div>
            <h2 className="lc-title">{t('logoCrop.title')}</h2>
          </div>
          <button type="button" className="me-close" onClick={onCancel} disabled={busy} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="lc-body">
          <div
            ref={viewportRef}
            className="lc-viewport"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {url && (
              <img
                ref={imgRef}
                src={url}
                alt=""
                draggable={false}
                onLoad={e => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                onError={() => setError(t('logoCrop.err.load'))}
                style={nat ? {
                  position: 'absolute',
                  width: dw, height: dh,
                  left: VIEW / 2 - dw / 2 + view.x,
                  top: VIEW / 2 - dh / 2 + view.y,
                } : { visibility: 'hidden', position: 'absolute' }}
              />
            )}
            <div className="lc-mask" />
          </div>

          <div className="lc-zoom">
            <ZoomOut size={16} />
            <input
              type="range" min={1} max={MAX_ZOOM} step={0.01}
              value={view.zoom}
              onChange={e => setZoom(Number(e.target.value))}
              aria-label={t('logoCrop.zoom')}
              disabled={!nat}
            />
            <ZoomIn size={16} />
          </div>

          <p className="lc-hint">{t('logoCrop.hint')}</p>
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="lc-footer">
          <button type="button" className="btn btn--outline-dark" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button" className="btn btn--primary"
            style={{ width: 'auto', minWidth: 160, marginTop: 0 }}
            onClick={handleConfirm} disabled={!nat || busy}
          >
            {busy ? t('profile.logo.uploading') : t('logoCrop.save')}
          </button>
        </div>
      </div>
    </div>
  )
}