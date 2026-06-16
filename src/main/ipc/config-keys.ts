// Config keys for the Audio/MIDI setup panel.
// Output/input: '' (absent) = system default (-o dac / -iadc with no index).
// Input 'none' = disable mic. MIDI '' = off.
export const AUDIO_OUTPUT_KEY = 'audioOutputDevice'
export const AUDIO_INPUT_KEY = 'audioInputDevice'
export const MIDI_INPUT_KEY = 'midiInputDevice'

export const AUDIO_KEYS = [AUDIO_OUTPUT_KEY, AUDIO_INPUT_KEY, MIDI_INPUT_KEY] as const

/** Stored when the user disables mic/input entirely. */
export const AUDIO_INPUT_OFF = 'none'
