import { IpcMain } from 'electron'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { normalizeNamedInstruments } from '../csound/normalize'
import { Log } from '../util/log'
import { withCsoundPath } from '../util/csound-path'

const execFileAsync = promisify(execFile)

let playProcess: ChildProcess | null = null
let playKilledBySignal = false

function getTempDir(): string {
  const dir = join(app.getPath('temp'), 'drc')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

// Csound's stderr is noisy: it prints an ANSI-colored banner (rtaudio module,
// version, device list, sr/kr/ksmps, PortAudio revision) before any real error.
// This function extracts the meaningful error line — if any — so we don't
// surface "rtaudio: PortAudio module enabled …" as the error message.
function extractCsoundError(raw: string): string {
  const stripped = raw.replace(/\x1b\[[0-9;]*m/g, '')
  const lines = stripped.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return ''

  const isBanner = (l: string) =>
    /^rtaudio[:\s]/i.test(l) ||
    /^rtmidi[:\s]/i.test(l) ||
    /^--Csound version/i.test(l) ||
    /^\[commit:/i.test(l) ||
    /^libsndfile/i.test(l) ||
    /^PortAudio[:\s]/i.test(l) ||
    /^PortMIDI/i.test(l) ||
    /^using callback interface/i.test(l) ||
    /^audio buffered in/i.test(l) ||
    /^writing \d+ sample blks/i.test(l) ||
    /^\d+:\s*dac\d+/i.test(l) ||
    /^\d+:\s*adc\d+/i.test(l) ||
    /^sr\s*=/i.test(l) ||
    /^0dBFS level/i.test(l) ||
    /^SECTION \d+/i.test(l) ||
    /^end of score/i.test(l) ||
    /^Elapsed time/i.test(l) ||
    /^overall amps/i.test(l) ||
    /^overall samples out of range/i.test(l) ||
    /^\d+\s+errors in performance/i.test(l) ||
    /^closing device/i.test(l) ||
    /^\d+\s+\d+ sample blks/i.test(l) ||
    /^Score finished/i.test(l) ||
    /^Stopping on parser failure/i.test(l) ||
    /^selected (input|output)/i.test(l) ||
    /^real time midi input disabled/i.test(l) ||
    /^UnifiedCSD/i.test(l) ||
    /^scoreless operation/i.test(l) ||
    /^orchname:/i.test(l) ||
    // Score-time markers and benign note-lifecycle info
    /^B\s+[\d.]+/i.test(l) ||
    /note deleted/i.test(l) ||
    /^new alloc for instr/i.test(l) ||
    /^instr\s+\d+:/i.test(l) ||
    /^removed instr/i.test(l) ||
    /^Seeding from current time/i.test(l) ||
    /^ftable\s+\d+:/i.test(l) ||
    /^Score: end of/i.test(l)

  // Prefer the concrete error line (e.g. "error: Unable to find opcode entry…")
  // over generic summaries so the user sees the actionable cause. We also pull
  // the "Line: NN" hint right after the error when csound provides it.
  const errorLines = lines.filter((l) => /error|cannot|unexpected|failed|syntax|undefined/i.test(l) && !isBanner(l))
  if (errorLines.length) {
    const msg = errorLines.slice(0, 3).join(' | ')
    const lineHint = stripped.match(/Line:\s*(\d+)/i)
    return lineHint ? `${msg} (line ${lineHint[1]})` : msg
  }

  // Performance-level red flags — only reported if no concrete error line exists.
  // Silent output with "overall amps: 0.0" almost always means no notes fired.
  const perfErrMatch = stripped.match(/(\d+)\s+errors in performance/i)
  if (perfErrMatch && parseInt(perfErrMatch[1], 10) > 0) {
    const noteDeleted = stripped.match(/note deleted\.\s*([^\n]+)/i)
    const detail = noteDeleted ? ` — ${noteDeleted[1].trim()}` : ''
    return `${perfErrMatch[1]} error${perfErrMatch[1] === '1' ? '' : 's'} during performance${detail}`
  }
  if (/overall amps:\s+0\.00000\s+0\.00000/i.test(stripped)) {
    return 'Silent output — no instrument events fired (check score numbers match instr definitions)'
  }

  const warnLines = lines.filter((l) => /!!|WARNING/.test(l) && !isBanner(l))
  if (warnLines.length) return warnLines.slice(0, 2).join(' | ')

  return ''
}

export function handleCsoundIPC(ipcMain: IpcMain): void {
  // Write CSD content to temp file, return the path.
  // Rewrites named instruments (instr Bell, i "Bell" ...) to numbered ones because
  // Csound 6.18 can't resolve named-instrument score events. Preserves source CSD
  // in the renderer; only the on-disk copy passed to the csound binary is normalized.
  //
  // Also unfolds single-line <CsOptions>-odac -d</CsOptions> into multi-line form.
  // Csound 6.18 has a parser bug where a one-liner with multiple flags reports
  // "Invalid arguments in <CsOptions>: <CsInstruments>" under --syntax-check-only,
  // which would otherwise abort the Player's compile step before play. Our adapt
  // template emits the one-liner; users may bring CSDs that do too.
  ipcMain.handle('csound:writeCsd', async (_event, content: string) => {
    const tmpPath = join(getTempDir(), 'current.csd')
    const { csd: namedFixed } = normalizeNamedInstruments(content)
    const normalized = namedFixed.replace(
      /<CsOptions>([^\n<]*)<\/CsOptions>/i,
      (_, body: string) => `<CsOptions>\n${body.trim()}\n</CsOptions>`,
    )
    writeFileSync(tmpPath, normalized, 'utf-8')
    return { path: tmpPath }
  })

  ipcMain.handle('csound:compile', async (_event, csdPath: string) => {
    try {
      // -n alongside --syntax-check-only sidesteps a Csound 6.18 bug where
      // `--syntax-check-only` *alone* mis-parses <CsOptions> and reports
      // "Invalid arguments in <CsOptions>: <CsInstruments>" for any valid
      // unified CSD. -n means "no sound to disk" — combined with the syntax
      // flag it's still parse-only, just under a code path that works.
      const { stdout, stderr } = await execFileAsync('csound', ['--syntax-check-only', '-n', csdPath], { timeout: 10000, env: withCsoundPath() })
      return { success: true, output: (stdout + '\n' + stderr).trim() || 'Compilation successful — no errors.' }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return { success: false, error: 'Csound not found. Install Csound and make sure it\'s on your PATH.' }
      }
      const raw = err.stderr || err.message || 'Unknown error'
      return { success: false, error: extractCsoundError(raw) || raw }
    }
  })

  ipcMain.handle('csound:render', async (_event, csdPath: string, opts?: { output?: string }) => {
    const outputPath = opts?.output || join(getTempDir(), 'output.wav')
    try {
      const { stdout, stderr } = await execFileAsync('csound', ['-o', outputPath, csdPath], { timeout: 30000, env: withCsoundPath() })
      return { success: true, output: `Rendered to ${outputPath}\n${(stdout + '\n' + stderr).trim()}` }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return { success: false, error: 'Csound not found. Install Csound and make sure it\'s on your PATH.' }
      }
      // Csound often exits non-zero but still produces output
      if (existsSync(outputPath)) {
        return { success: true, output: `Rendered to ${outputPath} (with warnings)` }
      }
      return { success: false, error: extractCsoundError(err.stderr || '') || err.message }
    }
  })

  ipcMain.handle('csound:play', async (_event, csdPath: string) => {
    // Kill any existing playback
    if (playProcess) {
      playKilledBySignal = true
      playProcess.kill()
      playProcess = null
    }

    return new Promise((resolve) => {
      playKilledBySignal = false
      // -Lstdin lets us push live score events (i 1 0 2 440 0.8\n) into csound's
      // stdin while it's running. Without this the keyboard and knobs are dead.
      // pipe stdin so we can write to it from event/setChannel handlers.
      playProcess = spawn('csound', ['-odac', '-d', '-m0', '-Lstdin', csdPath], {
        timeout: 120000,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: withCsoundPath(),
      })

      let stderr = ''
      playProcess.stderr?.on('data', (d) => {
        const chunk = d.toString()
        stderr += chunk
        // Surface score-parse / channel errors from the live stdin stream so the
        // user sees why a knob move did nothing.
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          if (/INIT ERROR|PERF ERROR|error:|unknown opcode|unquoted|Unknown opcode|not a valid score/i.test(trimmed)) {
            Log.warn(`csound> ${trimmed}`)
          }
        }
      })
      playProcess.stdout?.on('data', (d) => {
        const text = d.toString()
        for (const line of text.split('\n')) {
          const t = line.trim()
          if (t && /error|instr\s+100/i.test(t)) Log.info(`csound> ${t}`)
        }
      })

      // Swallow EPIPE noise that happens if csound has already exited when we try
      // to write. The next stdin.write() call will just fail cleanly.
      playProcess.stdin?.on('error', (err) => {
        Log.warn(`csound stdin error: ${err.message}`)
      })

      playProcess.on('close', (code, signal) => {
        playProcess = null
        if (signal || playKilledBySignal) {
          resolve({ success: true, output: 'Stopped.' })
          return
        }
        // Check for in-performance errors or silent output regardless of exit code —
        // Csound can exit 0 even when every note was deleted and amps were 0.
        const msg = extractCsoundError(stderr)
        if (msg) {
          resolve({ success: false, error: msg })
          return
        }
        if (code === 0 || code === null) {
          resolve({ success: true, output: 'Playback finished.' })
          return
        }
        // Non-zero exit but no recognized error in stderr — treat as clean.
        resolve({ success: true, output: 'Playback finished.' })
      })

      playProcess.on('error', (err) => {
        playProcess = null
        if ((err as any).code === 'ENOENT') {
          resolve({ success: false, error: 'Csound not found. Install Csound and make sure it\'s on your PATH.' })
        } else {
          resolve({ success: false, error: err.message })
        }
      })
    })
  })

  // Write a raw score line to the running csound stdin (enabled by -Lstdin in
  // csound:play). Caller is responsible for a valid score line — we only append
  // a newline if missing. No-op if nothing is playing.
  ipcMain.handle('csound:event', async (_event, line: string) => {
    if (!playProcess?.stdin || playProcess.stdin.destroyed) return { success: false, error: 'Not playing' }
    const ln = line.endsWith('\n') ? line : line + '\n'
    try {
      playProcess.stdin.write(ln)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Update a named control channel via the channel-writer helper (instr 100)
  // that the PLAYER_TEMPLATE bakes into every adapted CSD. Csound score lines
  // allow string p-fields when double-quoted, so:
  //     i 100 0 0 "frequency" 880
  // fires once, calls chnset inside instr 100, and updates the channel the
  // voice instrument reads via chnget.
  ipcMain.handle('csound:setChannel', async (_event, name: string, value: number) => {
    if (!playProcess) {
      Log.warn(`setChannel(${name}=${value}) — no play process`)
      return { success: false, error: 'Not playing' }
    }
    if (!playProcess.stdin || playProcess.stdin.destroyed) {
      Log.warn(`setChannel(${name}=${value}) — stdin unavailable (writable=${playProcess.stdin?.writable})`)
      return { success: false, error: 'stdin unavailable' }
    }
    const safe = String(name).replace(/[^a-zA-Z0-9_]/g, '')
    if (!safe) return { success: false, error: 'Invalid channel name' }
    const num = Number.isFinite(value) ? value : 0
    const line = `i 100 0 0 "${safe}" ${num}\n`
    try {
      const ok = playProcess.stdin.write(line)
      Log.info(`setChannel ${safe}=${num} → stdin.write ok=${ok}`)
      return { success: true }
    } catch (err: any) {
      Log.warn(`setChannel write failed: ${err.message}`)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('csound:stop', async () => {
    if (playProcess) {
      playKilledBySignal = true
      playProcess.kill()
      playProcess = null
      return { success: true }
    }
    return { success: true }
  })

}
