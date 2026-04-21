let counters = new Map<string, number>()

export function ascending(prefix: string): string {
  const count = (counters.get(prefix) || 0) + 1
  counters.set(prefix, count)
  return `${prefix}_${Date.now()}_${count.toString().padStart(4, '0')}`
}

export function reset() {
  counters = new Map()
}
