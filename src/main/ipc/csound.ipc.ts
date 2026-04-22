import { IpcMain } from 'electron'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { normalizeNamedInstruments } from '../csound/normalize'

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

  // Performance-level red flags: explicit "N errors in performance" (N > 0) or silent
  // output ("overall amps: 0.00000 0.00000") both indicate the CSD ran but didn't
  // produce any audio. These ARE banner lines, so we check them before filtering.
  const perfErrMatch = stripped.match(/(\d+)\s+errors in performance/i)
  if (perfErrMatch && parseInt(perfErrMatch[1], 10) > 0) {
    const noteDeleted = stripped.match(/note deleted\.\s*([^\n]+)/i)
    const detail = noteDeleted ? ` — ${noteDeleted[1].trim()}` : ''
    return `${perfErrMatch[1]} error${perfErrMatch[1] === '1' ? '' : 's'} during performance${detail}`
  }
  if (/overall amps:\s+0\.00000\s+0\.00000/i.test(stripped)) {
    return 'Silent output — no instrument events fired (check score numbers match instr definitions)'
  }

  const errorLines = lines.filter((l) => /error|cannot|unexpected|failed|syntax|undefined/i.test(l) && !isBanner(l))
  if (errorLines.length) return errorLines.slice(0, 4).join(' | ')

  const warnLines = lines.filter((l) => /!!|WARNING/.test(l) && !isBanner(l))
  if (warnLines.length) return warnLines.slice(0, 2).join(' | ')

  // No real error or warning detected — caller should treat this as a clean exit.
  return ''
}

export function handleCsoundIPC(ipcMain: IpcMain): void {
  // Write CSD content to temp file, return the path.
  // Rewrites named instruments (instr Bell, i "Bell" ...) to numbered ones because
  // Csound 6.18 can't resolve named-instrument score events. Preserves source CSD
  // in the renderer; only the on-disk copy passed to the csound binary is normalized.
  ipcMain.handle('csound:writeCsd', async (_event, content: string) => {
    const tmpPath = join(getTempDir(), 'current.csd')
    const { csd: normalized } = normalizeNamedInstruments(content)
    writeFileSync(tmpPath, normalized, 'utf-8')
    return { path: tmpPath }
  })

  ipcMain.handle('csound:compile', async (_event, csdPath: string) => {
    try {
      const { stdout, stderr } = await execFileAsync('csound', ['--syntax-check-only', csdPath], { timeout: 10000 })
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
      const { stdout, stderr } = await execFileAsync('csound', ['-o', outputPath, csdPath], { timeout: 30000 })
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
      playProcess = spawn('csound', ['-odac', '-d', '-m0', csdPath], { timeout: 120000 })

      let stderr = ''
      playProcess.stderr?.on('data', (d) => { stderr += d.toString() })

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

  ipcMain.handle('csound:stop', async () => {
    if (playProcess) {
      playKilledBySignal = true
      playProcess.kill()
      playProcess = null
      return { success: true }
    }
    return { success: true }
  })

  ipcMain.handle('csound:live:start', async (_event, _sessionID: string, _csdPath: string) => {
    return { success: false, error: 'Live engine not yet implemented' }
  })

  ipcMain.handle('csound:live:channel', async (_event, _sessionID: string, _ch: string, _val: number) => {
    return { success: false, error: 'Live engine not yet implemented' }
  })

  ipcMain.handle('csound:live:reload', async (_event, _sessionID: string, _orc: string) => {
    return { success: false, error: 'Live engine not yet implemented' }
  })
}
