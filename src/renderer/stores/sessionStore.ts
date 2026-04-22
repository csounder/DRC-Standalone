import { create } from 'zustand'

export type AgentMode = 'csound' | 'csound-sine' | 'sketch'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  type?: 'text' | 'tool_call' | 'tool_result' | 'narration'
  toolName?: string
  timestamp: number
}

interface SessionState {
  sessionID: string | null
  messages: Message[]
  agentMode: AgentMode
  isStreaming: boolean
  setSessionID: (id: string) => void
  addMessage: (msg: Message) => void
  appendToLast: (content: string) => void
  appendById: (id: string, content: string) => void
  setAgentMode: (mode: AgentMode) => void
  setStreaming: (streaming: boolean) => void
  clearMessages: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionID: null,
  messages: [],
  agentMode: 'csound',
  isStreaming: false,

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

  setAgentMode: (mode) => set({ agentMode: mode }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  clearMessages: () => set({ messages: [] }),
}))
