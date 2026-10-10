// Narzędzie do generowania palety kolorów CSS na podstawie barw logo
// kawiarni. Działa w całości po stronie przeglądarki (Canvas API).
// Wynik ma taki sam kształt jak wpisy w PALETTES (src/palettes.ts).

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

interface ColorBucket {
  r: number; g: number; b: number
  count: number
  hsl: Hsl
  chroma: number // 0..1 — (max-min)/255, odporna na zawyżone S w HSL przy skrajnych jasnościach
}

// Poniżej tej chromy kolor traktujemy jako neutralny (czerń/szarość/biel)
const NEUTRAL_CHROMA = 0.08
// Minimalna chroma, by kolor mógł zostać akcentem
const ACCENT_MIN_CHROMA = 0.18
// Minimalny udział kolorowych pikseli w logo, by w ogóle generować kolorowy akcent
const ACCENT_MIN_SHARE = 0.02

/** Saturacja dla danej roli: neutralne kolory zostają neutralne (S = 0),
 *  kolorowe są ograniczane do sensownego przedziału. */
function satFor(c: ColorBucket, min: number, max: number): number {
  return c.chroma < NEUTRAL_CHROMA ? 0 : clamp(c.hsl.s, min, max)
}

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

  // Grube przedziały (8 poziomów na kanał) — szum i antyaliasing wpadają
  // do jednego kubełka, a kolor kubełka to średnia prawdziwych pikseli.
  const bins = new Map<number, { r: number; g: number; b: number; count: number }>()
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue // pomiń przezroczyste piksele
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
    const e = bins.get(key)
    if (e) { e.r += r; e.g += g; e.b += b; e.count++ }
    else bins.set(key, { r, g, b, count: 1 })
    total++
  }

  if (total === 0) {
    throw new Error('Logo jest w całości przezroczyste — nie ma z czego wygenerować palety.')
  }

  const all: ColorBucket[] = Array.from(bins.values()).map(e => {
    const r = e.r / e.count, g = e.g / e.count, b = e.b / e.count
    return {
      r, g, b,
      count: e.count,
      hsl: rgbToHsl(r, g, b),
      chroma: (Math.max(r, g, b) - Math.min(r, g, b)) / 255,
    }
  })

  // Ignoruj śladowe kolory (< 1% pikseli) — to głównie szum z krawędzi
  const significant = all.filter(c => c.count >= total * 0.01)
  const colors = significant.length ? significant : all

  const darkest = colors.slice().sort((a, b) => a.hsl.l - b.hsl.l)[0]
  const lightPool = colors.filter(c => c.hsl.l < 92)
  const lightest = (lightPool.length ? lightPool : colors).slice().sort((a, b) => b.hsl.l - a.hsl.l)[0]

  // ── Akcent: ważony liczbą pikseli i chromą ───────────────────────────
  const chromatic = colors.filter(
    c => c.chroma >= ACCENT_MIN_CHROMA && c.hsl.l > 12 && c.hsl.l < 90,
  )
  const chromaticShare = chromatic.reduce((sum, c) => sum + c.count, 0) / total
  const hasColor = chromatic.length > 0 && chromaticShare >= ACCENT_MIN_SHARE

  const eh = darkest.hsl
  const ph = lightest.hsl

  let gold: string, goldHover: string, textMuted: string

  if (hasColor) {
    const accent = chromatic.slice().sort((a, b) => b.count * b.chroma - a.count * a.chroma)[0]
    const ah = accent.hsl
    gold      = hslToHex(ah.h, clamp(ah.s, 35, 88), clamp(ah.l, 32, 55))
    goldHover = hslToHex(ah.h, clamp(ah.s, 35, 88), clamp(ah.l + 13, 42, 66))
    textMuted = hslToHex(ah.h, clamp(ah.s, 5, 20), 46)
  } else {
    // Logo achromatyczne (czerń / szarość / biel) → neutralny, szary akcent
    const midPool = colors
      .filter(c => c.hsl.l >= 20 && c.hsl.l <= 75)
      .sort((a, b) => b.count - a.count)
    const l = midPool.length ? clamp(midPool[0].hsl.l, 32, 50) : 40
    gold      = hslToHex(0, 0, l)
    goldHover = hslToHex(0, 0, clamp(l + 13, 42, 66))
    textMuted = hslToHex(0, 0, 46)
  }

  return {
    '--espresso':   hslToHex(eh.h, satFor(darkest, 8, 55), clamp(eh.l, 4, 13)),
    '--coffee':     hslToHex(eh.h, satFor(darkest, 8, 50), clamp(eh.l + 6, 8, 20)),
    '--gold':       gold,
    '--gold-hover': goldHover,
    '--parchment':  hslToHex(ph.h, satFor(lightest, 8, 28), clamp(Math.max(ph.l, 84), 84, 92)),
    '--cream':      hslToHex(ph.h, satFor(lightest, 3, 10), 98),
    '--surface':    '#FFFFFF',
    '--text-dark':  hslToHex(eh.h, satFor(darkest, 10, 45), clamp(eh.l + 2, 6, 16)),
    '--text-body':  hslToHex(eh.h, satFor(darkest, 8, 35), clamp(eh.l + 18, 18, 32)),
    '--text-muted': textMuted,
    '--border':     hslToHex(ph.h, satFor(lightest, 5, 20), 88),
  }
}

/** Pobiera obraz spod danego URL i generuje na jego podstawie paletę
 * kolorów w tym samym formacie co wpisy w PALETTES. */
export async function extractPaletteFromImageUrl(url: string): Promise<Record<string, string>> {
  let objectUrl: string | null = null
  try {
    // Logo jest wcześniej ładowane jako zwykły <img> (bez nagłówka Origin),
    // więc w cache przeglądarki ląduje odpowiedź BEZ nagłówków CORS. Kolejny
    // fetch() trafiał w nią i padał jako "Failed to fetch". Omijamy cache.
    const sep = url.includes('?') ? '&' : '?'
    let res: Response
    try {
      res = await fetch(`${url}${sep}_=${Date.now()}`, { cache: 'no-store', mode: 'cors' })
    } catch {
      throw new Error('Nie udało się połączyć z serwerem, aby pobrać logo. Spróbuj ponownie.')
    }
    if (!res.ok) throw new Error('Nie udało się pobrać pliku logo.')
    const blob = await res.blob()
    objectUrl = URL.createObjectURL(blob)
    const img = await loadImage(objectUrl)
    return buildPaletteFromImage(img)
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}