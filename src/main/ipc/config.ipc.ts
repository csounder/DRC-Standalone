import { IpcMain, dialog, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { Provider } from '../provider/provider'
import { loadConfig, setConfigValue, getConfigValue } from '../util/config'
import { detectCabbagePath } from '../util/cabbage-path'

// The only keys that hold provider API secrets — masked and surfaced by
// config:getApiKeys. Everything else in config.json (e.g. cabbagePath) is a
// plain setting and must NOT leak into the API-keys view.
const PROVIDER_KEYS = ['google', 'anthropic', 'openai'] as const

export function handleConfigIPC(ipcMain: IpcMain): void {
  // Load saved keys on startup
  try {
    const saved = loadConfig()
    if (Object.keys(saved).length > 0) {
      Provider.configure({
        googleKey: saved.google,
        anthropicKey: saved.anthropic,
        openaiKey: saved.openai,
      })
    }
  } catch {}

  ipcMain.handle('config:setApiKey', async (_event, provider: string, key: string) => {
    const config = setConfigValue(provider, key)

    // Reconfigure provider
    Provider.configure({
      googleKey: config.google,
      anthropicKey: config.anthropic,
      openaiKey: config.openai,
    })

    return { success: true, available: Provider.availableProviders() }
  })

  // Remove a saved provider key entirely. Without this a user who pasted a bad
  // key was stuck with it — the only recovery was hand-editing config.json. We
  // validate the provider name so a stray call can't wipe an unrelated setting
  // (e.g. cabbagePath), then reconfigure so the change takes effect immediately.
  ipcMain.handle('config:deleteApiKey', async (_event, provider: string) => {
    if (!PROVIDER_KEYS.includes(provider as (typeof PROVIDER_KEYS)[number])) {
      return { success: false, available: Provider.availableProviders() }
    }
    const config = setConfigValue(provider, '')
    Provider.configure({
      googleKey: config.google,
      anthropicKey: config.anthropic,
      openaiKey: config.openai,
    })
    return { success: true, available: Provider.availableProviders() }
  })

  ipcMain.handle('config:testApiKey', async (_event, provider: string) => {
    if (!PROVIDER_KEYS.includes(provider as (typeof PROVIDER_KEYS)[number])) {
      return { ok: false, message: `Unknown provider: ${provider}` }
    }
    if (!Provider.availableProviders().includes(provider)) {
      return { ok: false, message: 'No key saved for this provider yet.' }
    }
    return Provider.testApiKey(provider)
  })

  ipcMain.handle('config:getApiKeys', async () => {
    const config = loadConfig()
    // Return masked keys — provider secrets only, never other settings.
    const masked: Record<string, string> = {}
    for (const k of PROVIDER_KEYS) {
      const v = config[k]
      if (v && v.length > 8) {
        masked[k] = v.slice(0, 4) + '...' + v.slice(-4)
      } else if (v) {
        masked[k] = '***'
      }
    }
    return { keys: masked, available: Provider.availableProviders() }
  })

  // Cabbage install path — lets users point us at their exact app/binary when
  // auto-detection misses it. `exists` is echoed back so the UI can warn about a
  // typo'd path; `detected` is the auto-found install we'd use when no explicit
  // path is set, so the UI can show what will happen without configuration.
  ipcMain.handle('config:getCabbagePath', async () => {
    const path = getConfigValue('cabbagePath') ?? ''
    const detected = path ? '' : ((await detectCabbagePath()) ?? '')
    return { path, exists: path ? existsSync(path) : false, detected }
  })

  ipcMain.handle('config:setCabbagePath', async (_event, path: string) => {
    const trimmed = (path ?? '').trim()
    setConfigValue('cabbagePath', trimmed)
    return { success: true, path: trimmed, exists: trimmed ? existsSync(trimmed) : false }
  })

  // Force a fresh scan (e.g. after the user installs Cabbage without restarting).
  ipcMain.handle('config:detectCabbage', async () => {
    return { detected: (await detectCabbagePath(true)) ?? '' }
  })

  // Native picker — far lower friction than typing a path. On macOS the user
  // selects the .app bundle; elsewhere the Cabbage executable. We persist the
  // choice immediately so the next "Open in Cabbage" uses it.
  ipcMain.handle('config:chooseCabbagePath', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Choose Cabbage',
      properties: ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'Executable', extensions: ['exe'] }] : undefined,
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    const chosen = result.filePaths[0]
    setConfigValue('cabbagePath', chosen)
    return { canceled: false, path: chosen, exists: existsSync(chosen) }
  })
}
