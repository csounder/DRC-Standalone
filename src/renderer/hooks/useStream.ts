import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { isQuotaError, parseQuotaRetryMs } from '../lib/providerGuide'
import type { UsageRecord } from '../lib/usageFormat'

export function useStream() {
  const storeRef = useRef(useSessionStore)

  // IDs of the main-response and narration messages that are currently being
  // streamed, so each chunk appends to the right message regardless of what
  // the other stream emits in between. Reset on stream:complete.
  const mainIdRef = useRef<string | null>(null)
  const narrationIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!window.api?.stream) {
      console.warn('Stream API not available — running outside Electron?')
      return
    }

    const unsubChunk = window.api.stream.onChunk((chunk) => {
      const store = storeRef.current.getState()

      if (chunk.type === 'text') {
        if (mainIdRef.current) {
          store.appendById(mainIdRef.current, chunk.content)
        } else {
          const id = `msg_${Date.now()}_m_${Math.random().toString(36).slice(2, 6)}`
          mainIdRef.current = id
          store.addMessage({
            id,
            role: 'assistant',
            content: chunk.content,
            timestamp: Date.now(),
          })
        }
      } else if (chunk.type === 'narration') {
        if (narrationIdRef.current) {
          store.appendById(narrationIdRef.current, chunk.content)
        } else {
          const id = `msg_${Date.now()}_n_${Math.random().toString(36).slice(2, 6)}`
          narrationIdRef.current = id
          store.addMessage({
            id,
            role: 'assistant',
            content: chunk.content,
            type: 'narration',
            timestamp: Date.now(),
          })
        }
      } else if (chunk.type === 'suggestions') {
        // Clickable follow-up prompts attach to the current CONTEXT message.
        if (narrationIdRef.current) {
          try {
            const arr = JSON.parse(chunk.content)
            if (Array.isArray(arr)) store.setMessageSuggestions(narrationIdRef.current, arr)
          } catch {
            /* ignore malformed suggestions */
          }
        }
      } else if (chunk.type === 'usage') {
        try {
          const usage = JSON.parse(chunk.content) as UsageRecord
          store.recordUsage(usage)
          const targetId = mainIdRef.current ?? narrationIdRef.current
          if (targetId) store.attachUsageToMessage(targetId, usage)
        } catch {
          /* ignore malformed usage */
        }
      } else if (chunk.type === 'error') {
        if (isQuotaError(chunk.content)) {
          store.setQuotaCooldown(Date.now() + parseQuotaRetryMs(chunk.content))
        }
        store.addMessage({
          id: `msg_${Date.now()}_e`,
          role: 'assistant',
          content: chunk.content,
          type: 'error',
          timestamp: Date.now(),
        })
        store.setStreaming(false)
        mainIdRef.current = null
        narrationIdRef.current = null
      }
    })

    const unsubComplete = window.api.stream.onComplete((_result) => {
      storeRef.current.getState().setStreaming(false)
      mainIdRef.current = null
      narrationIdRef.current = null
    })

    return () => {
      unsubChunk()
      unsubComplete()
    }
  }, [])
}
