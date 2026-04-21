import { IpcMain } from 'electron'
import { Provider } from '../provider/provider'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

function getConfigPath(): string {
  const dir = join(app.getPath('userData'), 'drc')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'config.json')
}

function loadConfig(): Record<string, string> {
  const path = getConfigPath()
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {}
  }
  return {}
}

function saveConfig(config: Record<string, string>): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf-8')
}

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
    const config = loadConfig()
    config[provider] = key
    saveConfig(config)

    // Reconfigure provider
    Provider.configure({
      googleKey: config.google,
      anthropicKey: config.anthropic,
      openaiKey: config.openai,
    })

    return { success: true, available: Provider.availableProviders() }
  })

  ipcMain.handle('config:getApiKeys', async () => {
    const config = loadConfig()
    // Return masked keys
    const masked: Record<string, string> = {}
    for (const [k, v] of Object.entries(config)) {
      if (v && v.length > 8) {
        masked[k] = v.slice(0, 4) + '...' + v.slice(-4)
      } else if (v) {
        masked[k] = '***'
      }
    }
    return { keys: masked, available: Provider.availableProviders() }
  })
}
