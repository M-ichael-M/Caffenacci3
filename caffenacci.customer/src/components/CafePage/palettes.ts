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
  {
    key: 'graphite-steel',
    label: 'Stalowy Grafit',
    vars: {
      '--espresso': '#14181C', '--coffee': '#1D2329',
      '--gold': '#5C7A99', '--gold-hover': '#7093B3',
      '--parchment': '#E4E9ED', '--cream': '#F7F9FA', '--surface': '#FFFFFF',
      '--text-dark': '#171B1F', '--text-body': '#2E363D', '--text-muted': '#6C7780',
      '--border': '#DCE3E8',
    },
  },
  {
    key: 'lavender-dream',
    label: 'Lawendowy Sen',
    vars: {
      '--espresso': '#1E1526', '--coffee': '#2A1D36',
      '--gold': '#8B6FB0', '--gold-hover': '#A186C6',
      '--parchment': '#EDE4F5', '--cream': '#FAF7FC', '--surface': '#FFFFFF',
      '--text-dark': '#211830', '--text-body': '#3E2E50', '--text-muted': '#82749A',
      '--border': '#E3D9EE',
    },
  },
  {
    key: 'olive-grove',
    label: 'Oliwny Gaj',
    vars: {
      '--espresso': '#1B1F0F', '--coffee': '#282E17',
      '--gold': '#7A8C3F', '--gold-hover': '#93A652',
      '--parchment': '#E9EBD8', '--cream': '#F8F9F2', '--surface': '#FFFFFF',
      '--text-dark': '#1D2110', '--text-body': '#37401F', '--text-muted': '#7A805F',
      '--border': '#DFE3CC',
    },
  },
  {
    key: 'terracotta-clay',
    label: 'Terakotowa Glina',
    vars: {
      '--espresso': '#26140D', '--coffee': '#361D13',
      '--gold': '#C1602F', '--gold-hover': '#D6763F',
      '--parchment': '#F3DFCF', '--cream': '#FCF4EE', '--surface': '#FFFFFF',
      '--text-dark': '#2A1710', '--text-body': '#4C2A1C', '--text-muted': '#8C6C5B',
      '--border': '#EED9C9',
    },
  },
  {
    key: 'arctic-mint',
    label: 'Arktyczna Mięta',
    vars: {
      '--espresso': '#0B1F1B', '--coffee': '#0F2C26',
      '--gold': '#2FA394', '--gold-hover': '#3EBBAA',
      '--parchment': '#DAF0EA', '--cream': '#F2FBF9', '--surface': '#FFFFFF',
      '--text-dark': '#0D211D', '--text-body': '#20413A', '--text-muted': '#638B83',
      '--border': '#CFE9E2',
    },
  },
  {
    key: 'plum-noir',
    label: 'Śliwkowa Noc',
    vars: {
      '--espresso': '#1C0B14', '--coffee': '#2A101E',
      '--gold': '#9C3B6B', '--gold-hover': '#B84E80',
      '--parchment': '#EEDCE5', '--cream': '#FAF3F6', '--surface': '#FFFFFF',
      '--text-dark': '#20101A', '--text-body': '#3E1E30', '--text-muted': '#836274',
      '--border': '#E7D4DD',
    },
  },
]

export function getPalette(key: string): Palette {
  return PALETTES.find(p => p.key === key) ?? PALETTES[0]
}

export function getPaletteVars(key: string): CSSProperties {
  return getPalette(key).vars as CSSProperties
}
