import { create } from 'zustand'
import type { Theme } from '../styles/theme'
import { getInitialTheme } from '../styles/theme'

interface AppState {
  theme: Theme
  audioFeedbackEnabled: boolean
  activePage: string
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setAudioFeedback: (enabled: boolean) => void
  setActivePage: (page: string) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: getInitialTheme(),
  audioFeedbackEnabled: true,
  activePage: 'agent',

  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
  setAudioFeedback: (enabled) => set({ audioFeedbackEnabled: enabled }),
  setActivePage: (page) => set({ activePage: page }),
}))
