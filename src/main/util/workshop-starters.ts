import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface WorkshopStarterMeta {
  id: string
  title: string
  filename: string
  /** Player-ready — no LLM adapt needed */
  playerReady?: boolean
  description: string
}

export const WORKSHOP_STARTERS: WorkshopStarterMeta[] = [
  {
    id: 'player_fm_bell',
    title: 'FM Bell (Player)',
    filename: 'player_fm_bell.csd',
    playerReady: true,
    description: 'Shimmering dual-modulator FM bell (Dr.B golden model) — keyboard + knobs, no API key',
  },
  {
    id: 'player_pluck_bass',
    title: 'Ping-pong Bass (Player)',
    filename: 'player_pluck_bass.csd',
    playerReady: true,
    description: 'FM pluck bass with ping-pong delay — keyboard + knobs, no API key',
  },
  {
    id: 'player_fm_starter',
    title: 'Simple FM (Player)',
    filename: 'player_fm_starter.csd',
    playerReady: true,
    description: 'Workshop B2 golden model — 2-operator foscili FM, keyboard + knobs, no API key',
  },
  {
    id: 'fm_bell',
    title: 'FM Bell (Agent score)',
    filename: 'fm_bell_starter.csd',
    description: 'Shimmering FM bell with descending melody — Agent golden starter',
  },
  {
    id: 'pluck_bass',
    title: 'Ping-pong Bass (Agent score)',
    filename: 'pluck_bass_starter.csd',
    description: 'FM pluck bass with cross-fed vdelay3 echo — Agent golden starter',
  },
  {
    id: 'fm',
    title: 'FM Synth',
    filename: 'fm_starter.csd',
    description: 'Simple 2-op FM demo score',
  },
  {
    id: 'pad',
    title: 'Warm Pad',
    filename: 'pad_starter.csd',
    description: 'Sustained pad texture',
  },
]

function starterPaths(filename: string): string[] {
  return [
    join(__dirname, '../../resources/workshop-starters', filename),
    join(__dirname, '../../../resources/workshop-starters', filename),
    join(process.cwd(), 'resources/workshop-starters', filename),
  ]
}

export function findWorkshopStarterPath(filename: string): string | null {
  for (const p of starterPaths(filename)) {
    if (existsSync(p)) return p
  }
  return null
}

export function readWorkshopStarter(filename: string): string | null {
  const path = findWorkshopStarterPath(filename)
  if (!path) return null
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

export function listWorkshopStarters(): WorkshopStarterMeta[] {
  return WORKSHOP_STARTERS.filter((s) => findWorkshopStarterPath(s.filename) != null)
}
