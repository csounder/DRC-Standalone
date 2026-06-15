/** Display helpers for token/cost usage (mirrors main process estimates). */

export interface UsageRecord {
  providerID: string
  modelID: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUSD: number
  freeTier: boolean
  phase: 'main' | 'narration' | 'suggestions' | 'other'
}

export interface SessionUsageTotals {
  totalTokens: number
  totalCostUSD: number
  turnCount: number
}

export function formatTokenCount(n: number): string {
  return n.toLocaleString('en-US')
}

/** Short model label for the footer, e.g. gemini-2.5-flash */
export function shortModelName(modelID: string): string {
  const slash = modelID.lastIndexOf('/')
  return slash >= 0 ? modelID.slice(slash + 1) : modelID
}

export function formatCostUSD(usd: number, freeTier?: boolean): string {
  if (usd === 0 && freeTier) return '$0.00'
  if (usd > 0 && usd < 0.0001) return '<$0.0001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(usd)
}

export function sumUsage(records: UsageRecord[]): SessionUsageTotals {
  let totalTokens = 0
  let totalCostUSD = 0
  for (const r of records) {
    totalTokens += r.totalTokens
    totalCostUSD += r.costUSD
  }
  return { totalTokens, totalCostUSD, turnCount: records.length }
}
