// SATIE-inspired UI audio feedback
// Subtle sine tones from C major scale, max volume 0.075

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

const C_MAJOR = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25]

function playSine(freq: number, duration: number, volume = 0.04): void {
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + duration)
}

export const audioFeedback = {
  click: () => playSine(C_MAJOR[4], 0.08, 0.03),       // G4 tap
  hover: () => playSine(1800, 0.04, 0.015),              // high blip
  navigate: (index: number) => playSine(C_MAJOR[index % 8], 0.15, 0.04),
  success: () => {
    playSine(C_MAJOR[0], 0.3, 0.04)                      // C major triad
    setTimeout(() => playSine(C_MAJOR[2], 0.25, 0.03), 80)
    setTimeout(() => playSine(C_MAJOR[4], 0.2, 0.03), 160)
  },
  error: () => playSine(220, 0.2, 0.05),                 // low A warning
  toggle: (on: boolean) => playSine(on ? 659 : 440, 0.1, 0.03),
}
