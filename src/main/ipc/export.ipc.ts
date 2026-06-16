import { IpcMain, app, shell } from 'electron'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getConfigValue } from '../util/config'
import { detectCabbagePath } from '../util/cabbage-path'
import { detectCsoundQtPath } from '../util/csoundqt-path'
import { prepareCsdForCsoundQt } from '../../shared/csd-realtime-options'
import { launchExternalOnFile, LAUNCH_HINTS, MAC_FALLBACK } from '../util/launch-external'

// Saves a Cabbage-ified CSD to a stable path and tries to launch the Cabbage
// Studio app on it. We save first regardless — that way even if no Cabbage
// install can be found, the user can recover from the returned path.
function cabbageDir(): string {
  const dir = join(app.getPath('documents'), 'DrC', 'cabbage')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function csoundQtDir(): string {
  const dir = join(app.getPath('documents'), 'DrC', 'csoundqt')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function safeFileName(title: string): string {
  const base = title.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return (base || 'untitled') + '.csd'
}

function extractCsoundSynthesizer(content: string): string | null {
  const m = content.match(/<CsoundSynthesizer[\s\S]*?<\/CsoundSynthesizer>/i)
  if (m) return m[0]
  if (content.includes('<CsoundSynthesizer>')) return content
  return null
}

async function launchCabbage(csdPath: string) {
  const configured = (getConfigValue('cabbagePath') ?? '').trim()
  const preferred = configured || ((await detectCabbagePath()) ?? '')
  return launchExternalOnFile(csdPath, preferred, MAC_FALLBACK.cabbage, LAUNCH_HINTS.cabbage)
}

async function launchCsoundQt(csdPath: string) {
  const configured = (getConfigValue('csoundQtPath') ?? '').trim()
  const preferred = configured || ((await detectCsoundQtPath()) ?? '')
  return launchExternalOnFile(csdPath, preferred, MAC_FALLBACK.csoundqt, LAUNCH_HINTS.csoundqt)
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

  // Save a plain CSD and open in CsoundQt — IDE for editing, manual, opcode help.
  ipcMain.handle('export:openInCsoundQt', async (_event, content: string, title: string) => {
    const csd = extractCsoundSynthesizer(content)
    if (!csd) {
      return { success: false, error: 'No <CsoundSynthesizer> block found — open a CSD artifact first.' }
    }
    try {
      const path = join(csoundQtDir(), safeFileName(title))
      writeFileSync(path, prepareCsdForCsoundQt(csd), 'utf-8')
      const result = await launchCsoundQt(path)
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
