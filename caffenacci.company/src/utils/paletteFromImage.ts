// Narzędzie do generowania palety kolorów CSS na podstawie barw logo
// kawiarni. Działa w całości po stronie przeglądarki (Canvas API) — nie
// wymaga żadnych dodatkowych bibliotek. Wynik ma dokładnie taki sam kształt
// jak wpisy w PALETTES (src/palettes.ts), więc może być użyty zamiennie
// jako paleta "custom".

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Nie udało się wczytać obrazu logo.'))
    img.src = src
  })
}

function rgbToHex(r: number, g: number, b: number): string {
  const byte = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
  return (
    '#' + [byte(r), byte(g), byte(b)].map(x => x.toString(16).padStart(2, '0')).join('')
  ).toUpperCase()
}

interface Hsl { h: number; s: number; l: number }

function rgbToHsl(r: number, g: number, b: number): Hsl {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4; break
    }
    h /= 6
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360
  h /= 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100

  if (s === 0) {
    const v = l * 255
    return rgbToHex(v, v, v)
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return rgbToHex(
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

interface ColorBucket { r: number; g: number; b: number; count: number; hsl: Hsl }

function buildPaletteFromImage(img: HTMLImageElement): Record<string, string> {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Twoja przeglądarka nie obsługuje odczytu kolorów z obrazu.')

  ctx.drawImage(img, 0, 0, size, size)

  let data: Uint8ClampedArray
  try {
    data = ctx.getImageData(0, 0, size, size).data
  } catch {
    throw new Error('Nie udało się odczytać kolorów z logo. Spróbuj wgrać logo ponownie.')
  }

  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue // pomiń przezroczyste piksele
    const r = Math.round(data[i] / 16) * 16
    const g = Math.round(data[i + 1] / 16) * 16
    const b = Math.round(data[i + 2] / 16) * 16
    const key = `${r}-${g}-${b}`
    const existing = buckets.get(key)
    if (existing) existing.count++
    else buckets.set(key, { r, g, b, count: 1 })
  }

  if (buckets.size === 0) {
    throw new Error('Logo jest w całości przezroczyste — nie ma z czego wygenerować palety.')
  }

  const colors: ColorBucket[] = Array.from(buckets.values())
    .map(c => ({ ...c, hsl: rgbToHsl(c.r, c.g, c.b) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)

  const darkest = colors.slice().sort((a, b) => a.hsl.l - b.hsl.l)[0]
  const lightPool = colors.filter(c => c.hsl.l < 92)
  const lightest = (lightPool.length ? lightPool : colors).slice().sort((a, b) => b.hsl.l - a.hsl.l)[0]
  const accentPool = colors.filter(c => c.hsl.s > 18 && c.hsl.l > 12 && c.hsl.l < 88)
  const accent = (accentPool.length ? accentPool : colors).slice().sort((a, b) => b.hsl.s - a.hsl.s)[0]

  const eh = darkest.hsl
  const ah = accent.hsl
  const ph = lightest.hsl

  return {
    '--espresso':   hslToHex(eh.h, clamp(eh.s, 8, 55), clamp(eh.l, 4, 13)),
    '--coffee':     hslToHex(eh.h, clamp(eh.s, 8, 50), clamp(eh.l + 6, 8, 20)),
    '--gold':       hslToHex(ah.h, clamp(ah.s, 35, 88), clamp(ah.l, 32, 55)),
    '--gold-hover': hslToHex(ah.h, clamp(ah.s, 35, 88), clamp(ah.l + 13, 42, 66)),
    '--parchment':  hslToHex(ph.h, clamp(ph.s, 8, 28), clamp(Math.max(ph.l, 84), 84, 92)),
    '--cream':      hslToHex(ph.h, clamp(ph.s, 3, 10), 98),
    '--surface':    '#FFFFFF',
    '--text-dark':  hslToHex(eh.h, clamp(eh.s, 10, 45), clamp(eh.l + 2, 6, 16)),
    '--text-body':  hslToHex(eh.h, clamp(eh.s, 8, 35), clamp(eh.l + 18, 18, 32)),
    '--text-muted': hslToHex(ah.h, clamp(ah.s, 5, 20), 46),
    '--border':     hslToHex(ph.h, clamp(ph.s, 5, 20), 88),
  }
}

/** Pobiera obraz spod danego URL i generuje na jego podstawie paletę
 * kolorów w tym samym formacie co wpisy w PALETTES. Rzuca błąd z czytelnym
 * komunikatem po polsku, jeśli obraz nie mógł zostać pobrany/odczytany. */
export async function extractPaletteFromImageUrl(url: string): Promise<Record<string, string>> {
  let objectUrl: string | null = null
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Nie udało się pobrać pliku logo.')
    const blob = await res.blob()
    objectUrl = URL.createObjectURL(blob)
    const img = await loadImage(objectUrl)
    return buildPaletteFromImage(img)
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}