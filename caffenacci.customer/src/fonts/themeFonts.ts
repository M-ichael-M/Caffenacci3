type Loader = () => Promise<unknown>

const inter800: Loader[] = [
  () => import('@fontsource/inter/latin-800.css'),
  () => import('@fontsource/inter/latin-ext-800.css'),
]
const cinzel: Loader[] = [
  () => import('@fontsource/cinzel/latin-700.css'),
  () => import('@fontsource/cinzel/latin-ext-700.css'),
]
const bungee: Loader[] = [
  () => import('@fontsource/bungee/latin-400.css'),
  () => import('@fontsource/bungee/latin-ext-400.css'),
]
const fredoka: Loader[] = [
  () => import('@fontsource/fredoka/latin-400.css'),
  () => import('@fontsource/fredoka/latin-ext-400.css'),
  () => import('@fontsource/fredoka/latin-500.css'),
  () => import('@fontsource/fredoka/latin-ext-500.css'),
  () => import('@fontsource/fredoka/latin-600.css'),
  () => import('@fontsource/fredoka/latin-ext-600.css'),
  () => import('@fontsource/fredoka/latin-700.css'),
  () => import('@fontsource/fredoka/latin-ext-700.css'),
]
const cormorant: Loader[] = [
  () => import('@fontsource/cormorant-garamond/latin-600.css'),
  () => import('@fontsource/cormorant-garamond/latin-ext-600.css'),
]
const spaceMono: Loader[] = [
  () => import('@fontsource/space-mono/latin-400.css'),
  () => import('@fontsource/space-mono/latin-ext-400.css'),
  () => import('@fontsource/space-mono/latin-700.css'),
  () => import('@fontsource/space-mono/latin-ext-700.css'),
]
const outfit: Loader[] = [
  () => import('@fontsource/outfit/latin-400.css'),
  () => import('@fontsource/outfit/latin-ext-400.css'),
  () => import('@fontsource/outfit/latin-500.css'),
  () => import('@fontsource/outfit/latin-ext-500.css'),
  () => import('@fontsource/outfit/latin-600.css'),
  () => import('@fontsource/outfit/latin-ext-600.css'),
  () => import('@fontsource/outfit/latin-700.css'),
  () => import('@fontsource/outfit/latin-ext-700.css'),
]
const orbitron: Loader[] = [() => import('@fontsource/orbitron/700.css')]

// Klucze = SiteTemplate z CafePage.tsx. Inter + Playfair są w baseFonts.ts.
export const THEME_FONTS: Record<string, Loader[]> = {
  classic:    [],
  modern:     inter800,
  magic:      cinzel,
  usa80s:     bungee,
  expressive: fredoka,
  premium:    cormorant,
  industrial: spaceMono,
  glass:      outfit,
  futuristic: [...orbitron, ...spaceMono, ...outfit],
  tiles:      outfit,
}

export function loadThemeFonts(template: string): Promise<unknown> {
  return Promise.all((THEME_FONTS[template] ?? []).map(load => load().catch(() => undefined)))
}