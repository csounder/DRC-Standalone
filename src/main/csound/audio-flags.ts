import { readFileSync } from 'fs'
import { getConfigValue } from '../util/config'
import { AUDIO_INPUT_OFF } from '../ipc/config-keys'
import { csdHasRealtimeOutputOptions } from './csd-playback'

export interface AudioIoConfig {
  output: string
  input: string
  midiInput: string
}

export function readAudioIoConfig(): AudioIoConfig {
  return {
    output: (getConfigValue('audioOutputDevice') ?? '').trim(),
    input: (getConfigValue('audioInputDevice') ?? '').trim(),
    midiInput: (getConfigValue('midiInputDevice') ?? '').trim(),
  }
}

/** Build csound CLI I/O flags from Settings + optional CSD on disk. */
export function buildRealtimeIoFlags(csdPath: string, cfg = readAudioIoConfig()): string[] {
  let csdHasOdac = false
  try {
    csdHasOdac = csdHasRealtimeOutputOptions(readFileSync(csdPath, 'utf-8'))
  } catch { /* no CSD yet */ }

  const flags: string[] = []

  // Output: explicit device → -odacN; system default → -odac unless CSD already has -odac.
  if (/^\d+$/.test(cfg.output)) {
    flags.push(`-odac${cfg.output}`)
  } else if (!csdHasOdac) {
    flags.push('-odac')
  }

  // Input: none/off/empty → skip (Player synth does not need a mic; -iadc can block macOS audio).
  if (!cfg.input || cfg.input === AUDIO_INPUT_OFF) {
    // no input
  } else if (/^\d+$/.test(cfg.input)) {
    flags.push(`-iadc${cfg.input}`)
  } else {
    flags.push('-iadc')
  }

  if (/^\d+$/.test(cfg.midiInput)) {
    flags.push('-+rtmidi=portmidi', `-M${cfg.midiInput}`)
  }

  return flags
}

/** True when Settings override CSD output (explicit dac index chosen). */
export function usesExplicitOutputDevice(cfg = readAudioIoConfig()): boolean {
  return /^\d+$/.test(cfg.output)
}

export function describeAudioRouting(csdPath: string, cfg = readAudioIoConfig()): string {
  const flags = buildRealtimeIoFlags(csdPath, cfg)
  if (flags.length === 0) {
    return 'Audio: using <CsOptions> from CSD (system output via file)'
  }
  const parts: string[] = []
  if (/^\d+$/.test(cfg.output)) parts.push(`output dac${cfg.output}`)
  else parts.push('output: system default')
  if (!cfg.input || cfg.input === AUDIO_INPUT_OFF) parts.push('input: none')
  else if (/^\d+$/.test(cfg.input)) parts.push(`input adc${cfg.input}`)
  else parts.push('input: system default')
  return `Audio: ${parts.join(', ')} → ${flags.join(' ')}`
}
