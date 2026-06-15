import { create } from 'zustand'
import type { UsageRecord } from '../lib/usageFormat'
import { useUsageStore } from './usageStore'

export type AgentMode = 'csound' | 'csound-sine'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'text' | 'tool_call' | 'tool_result' | 'narration' | 'error'
  toolName?: string
  timestamp: number
  suggestions?: string[] // one-click follow-up prompts (on narration messages)
  usage?: UsageRecord
}

// What failed last, so a subsequent successful play can be recorded as an
// error→fix pair in memory. Set by playback.ts before it requests an autofix.
export interface LastFailure {
  errorRaw: string
  brokenCsd: string
  kind: 'compile' | 'runtime'
}

interface SessionState {
  sessionID: string | null
  messages: Message[]
  agentMode: AgentMode
  isStreaming: boolean
  lastFailure: LastFailure | null
  quotaCooldownUntil: number | null
  setSessionID: (id: string) => void
  addMessage: (msg: Message) => void
  appendToLast: (content: string) => void
  appendById: (id: string, content: string) => void
  setMessageSuggestions: (id: string, suggestions: string[]) => void
  setAgentMode: (mode: AgentMode) => void
  setStreaming: (streaming: boolean) => void
  clearMessages: () => void
  startNewSession: () => void
  setLastFailure: (f: LastFailure | null) => void
  setQuotaCooldown: (until: number | null) => void
  clearQuotaCooldown: () => void
  attachUsageToMessage: (messageId: string, usage: UsageRecord) => void
  sendFeedback: (kind: string, payload?: Record<string, unknown>) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionID: null,
  messages: [],
  agentMode: 'csound',
  isStreaming: false,
  lastFailure: null,
  quotaCooldownUntil: null,

  setSessionID: (id) => set({ sessionID: id }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  appendToLast: (content) =>
    set((s) => {
      const msgs = [...s.messages]
      if (msgs.length > 0) {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: msgs[msgs.length - 1].content + content,
        }
      }
      return { messages: msgs }
    }),

  appendById: (id, content) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === id)
      if (idx === -1) return {}
      const msgs = [...s.messages]
      msgs[idx] = { ...msgs[idx], content: msgs[idx].content + content }
      return { messages: msgs }
    }),

  setMessageSuggestions: (id, suggestions) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === id)
      if (idx === -1) return {}
      const msgs = [...s.messages]
      msgs[idx] = { ...msgs[idx], suggestions }
      return { messages: msgs }
    }),

  setAgentMode: (mode) => set({ agentMode: mode }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  clearMessages: () => set({ messages: [] }),

  // Drop back to a clean slate; the next send() mints a fresh persisted session.
  startNewSession: () => {
    useUsageStore.getState().resetArea('agent')
    set({
      sessionID: null,
      messages: [],
      lastFailure: null,
      quotaCooldownUntil: null,
    })
  },

  setLastFailure: (f) => set({ lastFailure: f }),

  setQuotaCooldown: (until) => set({ quotaCooldownUntil: until }),
  clearQuotaCooldown: () => set({ quotaCooldownUntil: null }),

  attachUsageToMessage: (messageId, usage) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === messageId)
      if (idx === -1) return {}
      const msgs = [...s.messages]
      msgs[idx] = { ...msgs[idx], usage }
      return { messages: msgs }
    }),

  sendFeedback: (kind, payload) => {
    const sessionID = get().sessionID
    const p = window.api?.memory?.feedback?.(kind, { sessionId: sessionID, ...payload })
    // Let the profile badge refresh once the heuristic model has updated.
    void Promise.resolve(p).then(() =>
      window.dispatchEvent(new CustomEvent('drc:profile-changed')),
    )
  },
}))
