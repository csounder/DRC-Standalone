import { useEffect, useRef } from 'react'
import { useMidiStore, findBinding, type MidiBinding } from '../stores/midiStore'

// Lightweight structural types for Web MIDI. We don't import lib.dom's
// MIDIAccess directly because some TS lib targets don't include it; instead
// we type only the fields we actually touch and feed them via `unknown` casts.
interface MIDIMessageLike {
  data: Uint8Array | null
}
interface MIDIInputLike {
  id: string
  name: string | null
  manufacturer: string | null
  state: 'connected' | 'disconnected'
  onmidimessage: ((ev: MIDIMessageLike) => void) | null
}
interface MIDIPortStateChangeEvent {
  port: { type: 'input' | 'output' }
}
interface MIDIAccessLike {
  inputs: { values(): IterableIterator<MIDIInputLike> }
  onstatechange: ((ev: MIDIPortStateChangeEvent) => void) | null
}

export interface MidiHandlers {
  onNoteOn: (midi: number, velocity: number) => void
  onNoteOff: (midi: number) => void
  onCC?: (cc: number, value: number, portId: string) => void
}

// `useMidi` wires Web MIDI to the supplied note/CC callbacks and routes CC
// messages through MIDI Learn: an armed knob captures the next CC, otherwise
// CCs flow to the channel they're already bound to.
//
// The hook owns the lifetime of `onmidimessage` per input — it reattaches when
// the device list changes so hot-plug works without a refresh.
export function useMidi(handlers: MidiHandlers, knobChange: (channel: string, normalized: number) => void): void {
  const setStatus  = useMidiStore((s) => s.setStatus)
  const setInputs  = useMidiStore((s) => s.setInputs)
  const enabled    = useMidiStore((s) => s.enabled)
  // Pull ref-ish bits via getState() inside the message handler to avoid stale
  // closures every time bindings change — re-subscribing every binding edit
  // would drop incoming MIDI mid-press.
  const handlersRef = useRef(handlers)
  const knobChangeRef = useRef(knobChange)
  handlersRef.current = handlers
  knobChangeRef.current = knobChange

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      return
    }

    const nav = navigator as unknown as {
      requestMIDIAccess?: (opts?: { sysex?: boolean }) => Promise<unknown>
    }
    if (typeof nav.requestMIDIAccess !== 'function') {
      setStatus('unsupported', 'Web MIDI API unavailable in this browser')
      return
    }

    let access: MIDIAccessLike | null = null
    let cancelled = false

    const handleMessage = (portId: string) => (ev: MIDIMessageLike) => {
      const data = ev.data
      if (!data || data.length < 2) return
      const status = data[0] & 0xf0
      // noteOn with velocity 0 is a noteOff in convention.
      if (status === 0x90 && data[2] > 0) {
        handlersRef.current.onNoteOn(data[1], data[2] / 127)
        return
      }
      if (status === 0x80 || (status === 0x90 && data[2] === 0)) {
        handlersRef.current.onNoteOff(data[1])
        return
      }
      if (status === 0xb0) {
        const cc = data[1]
        const value = data[2] / 127
        const state = useMidiStore.getState()
        // If a knob is asking to learn, capture this CC — first event wins.
        if (state.learnTarget) {
          state.bind(cc, portId, state.learnTarget)
          return
        }
        // Otherwise, route through the persisted bindings.
        const binding: MidiBinding | undefined = findBinding(state.bindings, portId, cc)
        if (binding) {
          knobChangeRef.current(binding.channel, value)
        }
        handlersRef.current.onCC?.(cc, value, portId)
      }
    }

    const refreshInputs = () => {
      if (!access || cancelled) return
      const list: { id: string; name: string; manufacturer: string }[] = []
      for (const input of access.inputs.values()) {
        list.push({
          id: input.id,
          name: input.name ?? input.id,
          manufacturer: input.manufacturer ?? '',
        })
        // Reattach handler — Map.values() may return new objects on hotplug.
        input.onmidimessage = handleMessage(input.id)
      }
      setInputs(list)
    }

    setStatus('requesting')
    nav.requestMIDIAccess({ sysex: false })
      .then((acc) => {
        if (cancelled) return
        access = acc as MIDIAccessLike
        access.onstatechange = (ev: MIDIPortStateChangeEvent) => {
          if (ev.port.type === 'input') refreshInputs()
        }
        refreshInputs()
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setStatus('denied', msg)
      })

    return () => {
      cancelled = true
      if (access) {
        for (const input of access.inputs.values()) input.onmidimessage = null
        access.onstatechange = null
      }
    }
  }, [enabled, setInputs, setStatus])
}
