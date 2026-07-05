import type { CSSProperties } from 'react'

export interface Palette {
  key: string
  label: string
  vars: Record<string, string>
}

export const PALETTES: Palette[] = [
  {
    key: 'espresso-gold',
    label: 'Kawowa Klasyka',
    vars: {
      '--espresso': '#110A04', '--coffee': '#1E1108',
      '--gold': '#B5720A', '--gold-hover': '#D4900F',
      '--parchment': '#F0E4CC', '--cream': '#FAFAF7', '--surface': '#FFFFFF',
      '--text-dark': '#1A0F08', '--text-body': '#3D2B1A', '--text-muted': '#7A6050',
      '--border': '#E5D9CC',
    },
  },
  {
    key: 'forest-sage',
    label: 'Leśna Oaza',
    vars: {
      '--espresso': '#132018', '--coffee': '#1C2E22',
      '--gold': '#5B8C5A', '--gold-hover': '#6FA46D',
      '--parchment': '#E7EFE1', '--cream': '#F6F8F4', '--surface': '#FFFFFF',
      '--text-dark': '#16241A', '--text-body': '#2E3E32', '--text-muted': '#6B7C6F',
      '--border': '#DCE5D6',
    },
  },
  {
    key: 'midnight-berry',
    label: 'Północna Jagoda',
    vars: {
      '--espresso': '#170B1F', '--coffee': '#241030',
      '--gold': '#B0559C', '--gold-hover': '#C96FB4',
      '--parchment': '#EFE1EC', '--cream': '#F9F5F8', '--surface': '#FFFFFF',
      '--text-dark': '#1D0F27', '--text-body': '#3A2440', '--text-muted': '#7C6B81',
      '--border': '#E4D6E1',
    },
  },
  {
    key: 'ocean-breeze',
    label: 'Morska Bryza',
    vars: {
      '--espresso': '#0B1B24', '--coffee': '#102834',
      '--gold': '#2C8FA8', '--gold-hover': '#38A9C6',
      '--parchment': '#DFEEF2', '--cream': '#F4FAFB', '--surface': '#FFFFFF',
      '--text-dark': '#0E1F27', '--text-body': '#233E46', '--text-muted': '#6C848C',
      '--border': '#D4E6EA',
    },
  },
  {
    key: 'rose-latte',
    label: 'Różana Latte',
    vars: {
      '--espresso': '#2A1319', '--coffee': '#3A1B23',
      '--gold': '#C97183', '--gold-hover': '#DB8A9B',
      '--parchment': '#F6E2E6', '--cream': '#FCF6F7', '--surface': '#FFFFFF',
      '--text-dark': '#2C161B', '--text-body': '#4A2B31', '--text-muted': '#8A6B70',
      '--border': '#EEDBDF',
    },
  },
  {
    key: 'sunset-amber',
    label: 'Bursztynowy Zachód',
    vars: {
      '--espresso': '#26140A', '--coffee': '#341C0F',
      '--gold': '#D97A2E', '--gold-hover': '#EB9142',
      '--parchment': '#F7E6D4', '--cream': '#FDF7F0', '--surface': '#FFFFFF',
      '--text-dark': '#2A160B', '--text-body': '#4A2C18', '--text-muted': '#8A6E58',
      '--border': '#EEDCC6',
    },
  },
]

export function getPalette(key: string): Palette {
  return PALETTES.find(p => p.key === key) ?? PALETTES[0]
}

export function getPaletteVars(key: string): CSSProperties {
  return getPalette(key).vars as CSSProperties
}
