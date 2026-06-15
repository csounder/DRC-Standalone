/** Load bundled LAC workshop CSDs — no API key required. */

export interface WorkshopStarterMeta {
  id: string
  title: string
  filename: string
  playerReady?: boolean
  description: string
}

export async function listWorkshopStarters(): Promise<WorkshopStarterMeta[]> {
  try {
    return (await window.api?.workshop?.list?.()) ?? []
  } catch {
    return []
  }
}

export async function readWorkshopStarter(id: string): Promise<{ meta: WorkshopStarterMeta; content: string } | null> {
  try {
    const r: any = await window.api?.workshop?.read?.(id)
    if (!r?.ok || !r.content) return null
    return { meta: r.meta, content: r.content }
  } catch {
    return null
  }
}

/** Default one-tap demos for Player — fully player-ready, no LLM. */
export const WORKSHOP_PLAYER_DEMO_ID = 'player_fm_bell'
export const WORKSHOP_PLAYER_PLUCK_ID = 'player_pluck_bass'
export const WORKSHOP_PLAYER_FM_ID = 'player_fm_starter'

/** Agent landing buttons → pre-built Player CSDs (skip offline adapt). */
export const WORKSHOP_PLAYER_BY_AGENT: Record<string, string> = {
  fm_bell: WORKSHOP_PLAYER_DEMO_ID,
  pluck_bass: WORKSHOP_PLAYER_PLUCK_ID,
  fm_simple: WORKSHOP_PLAYER_FM_ID,
}

export async function loadWorkshopPlayerDemo(id = WORKSHOP_PLAYER_DEMO_ID): Promise<string | null> {
  const r = await readWorkshopStarter(id)
  return r?.content ?? null
}
