import { getConfigValue } from '../util/config'
import { AUDIO_INPUT_OFF } from '../ipc/config-keys'
import {
  type AudioDevice,
  realtimeAudioFlag,
  resolveAdcInputFlag,
  resolveDacOutputArg,
  resolveDefaultDacOutputArg,
  outputLabelForIndex,
} from '../util/audio-devices'

export interface AudioIoConfig {
  output: string
  input: string
  midiInput: string
}

export interface AudioDeviceContext {
  outputs: AudioDevice[]
  inputs: AudioDevice[]
}

export function readAudioIoConfig(): AudioIoConfig {
  return {
    output: (getConfigValue('audioOutputDevice') ?? '').trim(),
    input: (getConfigValue('audioInputDevice') ?? '').trim(),
    midiInput: (getConfigValue('midiInputDevice') ?? '').trim(),
  }
}

/** Build csound CLI I/O flags. Pass device lists from `csound --devices` for correct `-o dacN`. */
export function buildRealtimeIoFlags(
  _csdPath: string,
  cfg = readAudioIoConfig(),
  devices: AudioDeviceContext = { outputs: [], inputs: [] },
): string[] {
  const flags: string[] = [realtimeAudioFlag()]

  if (/^\d+$/.test(cfg.output)) {
    flags.push('-o', resolveDacOutputArg(cfg.output, devices.outputs))
  } else {
    flags.push('-o', resolveDefaultDacOutputArg(devices.outputs))
  }

  if (!cfg.input || cfg.input === AUDIO_INPUT_OFF) {
    // no input
  } else if (/^\d+$/.test(cfg.input)) {
    flags.push(resolveAdcInputFlag(cfg.input, devices.inputs))
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

export function describeAudioRouting(
  _csdPath: string,
  cfg = readAudioIoConfig(),
  devices: AudioDeviceContext = { outputs: [], inputs: [] },
): string {
  const flags = buildRealtimeIoFlags(_csdPath, cfg, devices)
  const parts: string[] = []
  if (/^\d+$/.test(cfg.output)) {
    parts.push(`output: ${outputLabelForIndex(cfg.output, devices.outputs)}`)
  } else {
    const dac = resolveDefaultDacOutputArg(devices.outputs)
    const dev = devices.outputs.find((d) => d.id === dac)
    parts.push(dev ? `output: ${dev.name} (${dev.id}, system default)` : 'output: system default (-o dac)')
  }
  if (!cfg.input || cfg.input === AUDIO_INPUT_OFF) parts.push('input: none')
  else if (/^\d+$/.test(cfg.input)) {
    const dev = devices.inputs.find((d) => String(d.index) === cfg.input)
    parts.push(dev ? `input: ${dev.name}` : `input adc${cfg.input}`)
  } else parts.push('input: system default')
  return `Audio: ${parts.join(', ')} → ${flags.join(' ')}`
}
