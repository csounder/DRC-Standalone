export type Theme = 'light' | 'dark'

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
}

export function getInitialTheme(): Theme {
  const stored = localStorage.getItem('drc-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

// SATIE jewel-tone palette for knowledge graph communities
export const COMMUNITY_COLORS = [
  '#7cb8a4', // sage
  '#8b6914', // gold
  '#7B68AE', // purple
  '#D4748A', // rose
  '#3D8B8B', // teal
  '#6A7FDB', // blue
  '#C75D5D', // red
  '#4A90A4', // cyan
  '#C4915E', // sienna
  '#9B8A6E', // tan
  '#5B8C5A', // green
  '#a8d5a2', // mint
  '#f0b27a', // peach
  '#c5a3d9', // lavender
  '#f4a6a0', // coral
  '#7eb8da', // sky
  '#b8c98a', // chartreuse
  '#d4a574', // amber
  '#8faabe', // steel
  '#c9b8d9', // lilac
]

// Entity type colors for knowledge graph
export const ENTITY_COLORS: Record<string, string> = {
  person: '#5B8C5A',
  organization: '#8B6914',
  place: '#C4915E',
  concept: '#6A7FDB',
  artwork: '#C75D5D',
  technology: '#4A90A4',
  event: '#3D8B8B',
  time_period: '#9B8A6E',
}
