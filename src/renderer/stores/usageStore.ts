import { create } from 'zustand'
import type { UsageRecord, SessionUsageTotals } from '../lib/usageFormat'

export type UsageArea = 'agent' | 'player'

interface AreaUsage {
  last: UsageRecord | null
  totals: SessionUsageTotals
}

const emptyTotals = (): SessionUsageTotals => ({
  totalTokens: 0,
  totalCostUSD: 0,
  turnCount: 0,
})

interface UsageState {
  agent: AreaUsage
  player: AreaUsage
  record: (area: UsageArea, usage: UsageRecord) => void
  resetArea: (area: UsageArea) => void
  combinedTotals: () => SessionUsageTotals
}

export const useUsageStore = create<UsageState>((set, get) => ({
  agent: { last: null, totals: emptyTotals() },
  player: { last: null, totals: emptyTotals() },

  record: (area, usage) =>
    set((s) => {
      const cur = s[area]
      return {
        [area]: {
          last: usage,
          totals: {
            totalTokens: cur.totals.totalTokens + usage.totalTokens,
            totalCostUSD: cur.totals.totalCostUSD + usage.costUSD,
            turnCount: cur.totals.turnCount + 1,
          },
        },
      } as Pick<UsageState, UsageArea>
    }),

  resetArea: (area) =>
    set({ [area]: { last: null, totals: emptyTotals() } } as Pick<UsageState, UsageArea>),

  combinedTotals: () => {
    const { agent, player } = get()
    return {
      totalTokens: agent.totals.totalTokens + player.totals.totalTokens,
      totalCostUSD: agent.totals.totalCostUSD + player.totals.totalCostUSD,
      turnCount: agent.totals.turnCount + player.totals.turnCount,
    }
  },
}))
