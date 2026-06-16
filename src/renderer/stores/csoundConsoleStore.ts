import { create } from 'zustand'

const STORAGE_KEY = 'drc-csound-console-enabled'

export type CsoundOutputStream = 'stdout' | 'stderr' | 'info'

export interface CsoundOutputLine {
  stream: CsoundOutputStream
  text: string
  ts: number
}

const ERROR_LINE =
  /error|cannot|unexpected|failed|syntax|undefined|INIT ERROR|PERF ERROR|too many arguments/i

export function isCsoundErrorLine(text: string): boolean {
  return ERROR_LINE.test(text)
}

export function formatCsoundConsoleLines(lines: CsoundOutputLine[]): string {
  return lines.map((l) => l.text).join('\n')
}

function loadEnabled(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === null) return false
    return v === '1'
  } catch {
    return false
  }
}

interface CsoundConsoleState {
  enabled: boolean
  expanded: boolean
  lines: CsoundOutputLine[]
  setEnabled: (enabled: boolean) => void
  toggle: () => void
  setExpanded: (expanded: boolean) => void
  append: (chunk: { stream: CsoundOutputStream; text: string }) => void
  clear: () => void
}

export const useCsoundConsoleStore = create<CsoundConsoleState>((set, get) => ({
  enabled: loadEnabled(),
  expanded: loadEnabled(),
  lines: [],
  setEnabled: (enabled) => {
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
    } catch { /* ignore */ }
    set({ enabled, expanded: enabled ? true : get().expanded })
  },
  toggle: () => {
    const next = !get().enabled
    get().setEnabled(next)
  },
  setExpanded: (expanded) => set({ expanded }),
  append: (chunk) => {
    const text = chunk.text.trimEnd()
    if (!text) return
    const hasError = isCsoundErrorLine(text)
    set((s) => {
      const nextLines = [
        ...s.lines,
        { stream: chunk.stream, text, ts: Date.now() },
      ].slice(-800)
      if (!hasError) return { lines: nextLines }
      try {
        localStorage.setItem(STORAGE_KEY, '1')
      } catch { /* ignore */ }
      return { lines: nextLines, enabled: true, expanded: true }
    })
  },
  clear: () => set({ lines: [] }),
}))
