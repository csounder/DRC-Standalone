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

/** Default one-tap demo for Player — fully player-ready, no LLM. */
export const WORKSHOP_PLAYER_DEMO_ID = 'player_fm_bell'

export async function loadWorkshopPlayerDemo(): Promise<string | null> {
  const r = await readWorkshopStarter(WORKSHOP_PLAYER_DEMO_ID)
  return r?.content ?? null
}
