import { create } from 'zustand'

export type PlaybackStatus = 'idle' | 'compiling' | 'playing' | 'error'

interface PlaybackState {
  artifactId: string | null
  status: PlaybackStatus
  message: string
  set: (patch: Partial<Pick<PlaybackState, 'artifactId' | 'status' | 'message'>>) => void
  clear: () => void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  artifactId: null,
  status: 'idle',
  message: '',
  set: (patch) => set(patch),
  clear: () => set({ artifactId: null, status: 'idle', message: '' }),
}))
