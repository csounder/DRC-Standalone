type Handler = (...args: any[]) => void

const listeners = new Map<string, Set<Handler>>()

export const Bus = {
  on(event: string, handler: Handler): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event)!.add(handler)
    return () => listeners.get(event)?.delete(handler)
  },

  emit(event: string, ...args: any[]): void {
    listeners.get(event)?.forEach((h) => {
      try { h(...args) } catch {}
    })
  },

  off(event: string, handler: Handler): void {
    listeners.get(event)?.delete(handler)
  },
}
