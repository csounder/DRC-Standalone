import { useEffect, useRef } from 'react'
import { useSessionStore } from '../stores/sessionStore'

export function useStream() {
  // Use refs to avoid stale closures
  const storeRef = useRef(useSessionStore)

  useEffect(() => {
    if (!window.api?.stream) {
      console.warn('Stream API not available — running outside Electron?')
      return
    }

    const unsubChunk = window.api.stream.onChunk((chunk) => {
      const store = storeRef.current.getState()

      if (chunk.type === 'text') {
        const msgs = store.messages
        const last = msgs[msgs.length - 1]
        // Append to existing assistant message, or create one
        if (last && last.role === 'assistant' && !last.type) {
          store.appendToLast(chunk.content)
        } else {
          store.addMessage({
            id: `msg_${Date.now()}`,
            role: 'assistant',
            content: chunk.content,
            timestamp: Date.now(),
          })
        }
      } else if (chunk.type === 'error') {
        store.addMessage({
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: chunk.content,
          timestamp: Date.now(),
        })
        store.setStreaming(false)
      }
    })

    const unsubComplete = window.api.stream.onComplete((_result) => {
      storeRef.current.getState().setStreaming(false)
    })

    return () => {
      unsubChunk()
      unsubComplete()
    }
  }, [])
}
