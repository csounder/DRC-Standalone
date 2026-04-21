import { create } from 'zustand'

interface PlayerState {
  isPlaying: boolean
  isLiveMode: boolean
  currentTime: number
  duration: number
  channels: Record<string, number>
  setPlaying: (playing: boolean) => void
  setLiveMode: (live: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setChannel: (name: string, value: number) => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  isPlaying: false,
  isLiveMode: false,
  currentTime: 0,
  duration: 0,
  channels: {},

  setPlaying: (playing) => set({ isPlaying: playing }),
  setLiveMode: (live) => set({ isLiveMode: live }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setChannel: (name, value) =>
    set((s) => ({ channels: { ...s.channels, [name]: value } })),
}))
