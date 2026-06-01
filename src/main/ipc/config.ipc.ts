import { IpcMain } from 'electron'
import { existsSync } from 'fs'
import { Provider } from '../provider/provider'
import { loadConfig, setConfigValue, getConfigValue } from '../util/config'

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
  // the auto-detected names don't match. `exists` is echoed back so the UI can
  // warn about a typo'd path before they ever hit "Open in Cabbage".
  ipcMain.handle('config:getCabbagePath', async () => {
    const path = getConfigValue('cabbagePath') ?? ''
    return { path, exists: path ? existsSync(path) : false }
  })

  ipcMain.handle('config:setCabbagePath', async (_event, path: string) => {
    const trimmed = (path ?? '').trim()
    setConfigValue('cabbagePath', trimmed)
    return { success: true, path: trimmed, exists: trimmed ? existsSync(trimmed) : false }
  })
}
