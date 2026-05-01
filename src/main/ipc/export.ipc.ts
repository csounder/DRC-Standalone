import { IpcMain, app, shell } from 'electron'
import { spawn } from 'child_process'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// Saves a Cabbage-ified CSD to a stable path and tries to launch the Cabbage
// Studio app on it. We save first regardless — that way even if no Cabbage
// install can be found, the user can recover from the returned path.
function cabbageDir(): string {
  const dir = join(app.getPath('documents'), 'DrC', 'cabbage')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function safeFileName(title: string): string {
  // Lower-cased, alphanumeric + hyphen — keeps the path predictable across
  // platforms and avoids surprises when the title has Unicode or punctuation.
  const base = title.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return (base || 'untitled') + '.csd'
}

// Launch Cabbage with the saved CSD. Returns true if the spawn was accepted —
// not whether the app eventually opened. We try a couple of common app names
// before falling back to the OS file-association path.
function launchCabbage(csdPath: string): { ok: boolean; method: string; error?: string } {
  const platform = process.platform
  if (platform === 'darwin') {
    // `open -a` returns non-zero immediately if the app isn't found, so we can
    // try a couple of bundle identifiers / display names without spamming the
    // user. -W would block; we want fire-and-forget.
    for (const appName of ['Cabbage', 'Cabbage Studio', 'CabbagePro']) {
      try {
        const child = spawn('open', ['-a', appName, csdPath], { detached: true, stdio: 'ignore' })
        child.unref()
        return { ok: true, method: `open -a "${appName}"` }
      } catch {
        // fall through to next candidate
      }
    }
    // Last-ditch: hand off to the OS, which uses the user's default .csd handler.
    void shell.openPath(csdPath)
    return { ok: true, method: 'shell.openPath' }
  }
  if (platform === 'win32') {
    // Windows: rely on the file association (Cabbage's installer registers it).
    void shell.openPath(csdPath)
    return { ok: true, method: 'shell.openPath' }
  }
  // linux & friends
  try {
    const child = spawn('xdg-open', [csdPath], { detached: true, stdio: 'ignore' })
    child.unref()
    return { ok: true, method: 'xdg-open' }
  } catch (err: any) {
    return { ok: false, method: 'xdg-open', error: err?.message ?? 'xdg-open failed' }
  }
}

export function handleExportIPC(ipcMain: IpcMain): void {
  ipcMain.handle('export:html', async (_event, _sessionID: string, _opts: any) => {
    // TODO: Port HTML export from opencode csound_export_html_template.ts
    return { success: false, error: 'Not yet implemented' }
  })

  // Save a Cabbage-ified CSD and launch Cabbage Studio on it. Replaces the
  // older session-based stub — the renderer now passes the artifact content
  // directly so we don't need to round-trip through session storage.
  ipcMain.handle('export:openInCabbage', async (_event, content: string, title: string) => {
    if (!content || !content.includes('<Cabbage>')) {
      return { success: false, error: 'CSD has no <Cabbage> section — convert it to a VST first.' }
    }
    try {
      const path = join(cabbageDir(), safeFileName(title))
      writeFileSync(path, content, 'utf-8')
      const result = launchCabbage(path)
      if (!result.ok) {
        return { success: false, error: `Saved to ${path} but couldn't launch Cabbage: ${result.error}`, path }
      }
      return { success: true, path, launchedVia: result.method }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Failed to write CSD' }
    }
  })

  // Legacy alias — the old preload bridge calls export:cabbage. Kept so an
  // out-of-date renderer still gets a structured error instead of an unhandled
  // IPC rejection.
  ipcMain.handle('export:cabbage', async () => {
    return { success: false, error: 'export:cabbage is deprecated — use export:openInCabbage' }
  })

  ipcMain.handle('export:stems', async (_event, _sessionID: string) => {
    // TODO: Port stems export from opencode
    return { success: false, error: 'Not yet implemented' }
  })

  ipcMain.handle('export:presetPack', async (_event, _sessionID: string) => {
    // TODO: Port preset pack export from opencode
    return { success: false, error: 'Not yet implemented' }
  })
}
