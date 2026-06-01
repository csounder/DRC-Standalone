import { IpcMain, app, shell } from 'electron'
import { spawn, execFile } from 'child_process'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getConfigValue } from '../util/config'
import { detectCabbagePath } from '../util/cabbage-path'

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

// Default macOS app names we probe with `open -a` when the user hasn't set an
// explicit path. Cabbage ships under a few display names across versions.
const MAC_APP_NAMES = ['Cabbage', 'CabbageLite', 'Cabbage Studio', 'CabbagePro']

// `open -a <app> <file>` exits non-zero (asynchronously) when the app can't be
// found — spawn never throws for that, so we MUST await the exit code rather
// than assume the launch worked. Resolves true only on a clean exit.
function openWithApp(appNameOrPath: string, csdPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('open', ['-a', appNameOrPath, csdPath], (err) => resolve(!err))
  })
}

// Spawn a Cabbage executable directly (Windows/Linux) with the CSD as its arg.
function spawnBinary(bin: string, csdPath: string): { ok: boolean; method: string; error?: string } {
  try {
    const child = spawn(bin, [csdPath], { detached: true, stdio: 'ignore' })
    child.unref()
    return { ok: true, method: `spawn "${bin}"` }
  } catch (err: any) {
    return { ok: false, method: `spawn "${bin}"`, error: err?.message ?? 'spawn failed' }
  }
}

// Launch Cabbage on the saved CSD, preferring the user-configured path. Unlike
// the old version this verifies the launch actually succeeded and reports an
// honest failure (with a Settings hint) when no Cabbage install can be found,
// instead of silently claiming success.
async function launchCabbage(csdPath: string): Promise<{ ok: boolean; method: string; error?: string }> {
  // Explicit setting wins; otherwise fall back to whatever we can auto-detect.
  const configured = (getConfigValue('cabbagePath') ?? '').trim()
  const preferred = configured || ((await detectCabbagePath()) ?? '')
  const platform = process.platform

  if (platform === 'darwin') {
    // Preferred path first (skip if it points nowhere), then known app names.
    const candidates = [preferred, ...MAC_APP_NAMES]
      .filter(Boolean)
      .filter((c) => !c.startsWith('/') || existsSync(c))
    for (const cand of candidates) {
      if (await openWithApp(cand, csdPath)) return { ok: true, method: `open -a "${cand}"` }
    }
    // Last resort: the OS default .csd handler. openPath returns '' on success
    // or an error string — only treat empty as a real open.
    const err = await shell.openPath(csdPath)
    if (!err) return { ok: true, method: 'default .csd handler' }
    return {
      ok: false,
      method: 'open',
      error: 'No Cabbage app found. Set its path in Settings → Cabbage.',
    }
  }

  if (platform === 'win32') {
    if (preferred && existsSync(preferred)) return spawnBinary(preferred, csdPath)
    const err = await shell.openPath(csdPath)
    if (!err) return { ok: true, method: 'default .csd handler' }
    return { ok: false, method: 'openPath', error: 'No Cabbage app found. Set its path in Settings → Cabbage.' }
  }

  // linux & friends
  if (preferred && existsSync(preferred)) return spawnBinary(preferred, csdPath)
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
      return { success: false, error: 'CSD has no <Cabbage> section — convert it to Cabbage first.' }
    }
    try {
      const path = join(cabbageDir(), safeFileName(title))
      writeFileSync(path, content, 'utf-8')
      const result = await launchCabbage(path)
      if (!result.ok) {
        return { success: false, error: `${result.error} Saved to ${path}`, path }
      }
      return { success: true, path, launchedVia: result.method }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Failed to write CSD' }
    }
  })

  // Reveal the saved CSD in Finder/Explorer — the fallback when Cabbage can't be
  // launched so the user can open it manually.
  ipcMain.handle('export:revealFile', async (_event, path: string) => {
    if (!path || !existsSync(path)) return { success: false, error: 'File not found' }
    shell.showItemInFolder(path)
    return { success: true }
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
