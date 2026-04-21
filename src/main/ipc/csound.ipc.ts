import { IpcMain } from 'electron'
import { execFile, spawn, type ChildProcess } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const execFileAsync = promisify(execFile)

let playProcess: ChildProcess | null = null

function getTempDir(): string {
  const dir = join(app.getPath('temp'), 'drc')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function handleCsoundIPC(ipcMain: IpcMain): void {
  // Write CSD content to temp file, return the path
  ipcMain.handle('csound:writeCsd', async (_event, content: string) => {
    const tmpPath = join(getTempDir(), 'current.csd')
    writeFileSync(tmpPath, content, 'utf-8')
    return { path: tmpPath }
  })

  ipcMain.handle('csound:compile', async (_event, csdPath: string) => {
    try {
      const { stdout, stderr } = await execFileAsync('csound', ['--syntax-check-only', csdPath], { timeout: 10000 })
      return { success: true, output: (stdout + '\n' + stderr).trim() || 'Compilation successful — no errors.' }
    } catch (err: any) {
      const stderr = err.stderr || err.message || 'Unknown error'
      // Csound exits non-zero on errors but also on some warnings
      if (err.code === 'ENOENT') {
        return { success: false, error: 'Csound not found. Install Csound and make sure it\'s on your PATH.' }
      }
      return { success: false, error: stderr }
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
        return { success: true, output: `Rendered to ${outputPath} (with warnings)\n${(err.stderr || '').slice(0, 500)}` }
      }
      return { success: false, error: err.stderr || err.message }
    }
  })

  ipcMain.handle('csound:play', async (_event, csdPath: string) => {
    // Kill any existing playback
    if (playProcess) {
      playProcess.kill()
      playProcess = null
    }

    return new Promise((resolve) => {
      playProcess = spawn('csound', ['-odac', '-d', '-m0', csdPath], { timeout: 120000 })

      let stderr = ''
      playProcess.stderr?.on('data', (d) => { stderr += d.toString() })

      playProcess.on('close', (code) => {
        playProcess = null
        if (code === 0 || code === null) {
          resolve({ success: true, output: 'Playback finished.' })
        } else {
          resolve({ success: false, error: stderr.slice(0, 500) || `Exit code ${code}` })
        }
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
