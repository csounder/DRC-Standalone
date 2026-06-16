import { isProPlus } from '../util/tier'
import { IpcMain, dialog, BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { Provider } from '../provider/provider'
import { loadConfig, saveConfig, setConfigValue, getConfigValue, type DrcConfig } from '../util/config'
import { detectCabbagePath } from '../util/cabbage-path'
import { detectCsoundQtPath } from '../util/csoundqt-path'
import { listAudioDevices } from '../util/audio-devices'
import {
  AUDIO_INPUT_OFF,
  AUDIO_OUTPUT_KEY,
  AUDIO_INPUT_KEY,
  MIDI_INPUT_KEY,
  AUDIO_KEYS,
} from '../ipc/config-keys'

// The only keys that hold provider API secrets — masked and surfaced by
// config:getApiKeys. Everything else in config.json (e.g. cabbagePath) is a
// plain setting and must NOT leak into the API-keys view.
const PROVIDER_KEYS = ['google', 'groq', 'anthropic', 'openai'] as const

/** Workshop default: Groq-only Agent — drop saved Gemini keys and preferOllama when Groq is present. */
function migrateProviderKeys(config: DrcConfig): DrcConfig {
  const next = { ...config }
  let changed = false
  if (next.google && !isProPlus()) {
    delete next.google
    changed = true
  }
  if (next.groq && next.preferOllama === '1') {
    delete next.preferOllama
    changed = true
  }
  return changed ? saveConfig(next) : config
}

function applyProviderConfig(config: Record<string, string | undefined>): void {
  Provider.configure({
    googleKey: isProPlus() ? config.google : undefined,
    groqKey: config.groq,
    anthropicKey: config.anthropic,
    openaiKey: config.openai,
    ollamaEnabled: config.ollamaEnabled === '1',
    ollamaModel: config.ollamaModel,
    ollamaBaseUrl: config.ollamaBaseUrl,
    preferOllama: config.preferOllama === '1',
  })
}

export function handleConfigIPC(ipcMain: IpcMain): void {
  // Load saved keys on startup
  try {
    const saved = migrateProviderKeys(loadConfig())
    if (Object.keys(saved).length > 0) {
      applyProviderConfig(saved)
    }
    void Provider.refreshOllamaStatus()
  } catch {}

  ipcMain.handle('config:setApiKey', async (_event, provider: string, key: string) => {
    if (provider === 'google' && !isProPlus()) {
      return {
        success: false,
        error: 'Free Gemini is disabled for workshops. Use Groq (below) or Web Apps (no key).',
        available: Provider.availableProviders(),
      }
    }
    const config = setConfigValue(provider, key)

    applyProviderConfig(config)

    return { success: true, available: Provider.availableProviders() }
  })

  // Remove a saved provider key entirely.
  // key was stuck with it — the only recovery was hand-editing config.json. We
  // validate the provider name so a stray call can't wipe an unrelated setting
  // (e.g. cabbagePath), then reconfigure so the change takes effect immediately.
  ipcMain.handle('config:deleteApiKey', async (_event, provider: string) => {
    if (!PROVIDER_KEYS.includes(provider as (typeof PROVIDER_KEYS)[number])) {
      return { success: false, available: Provider.availableProviders() }
    }
    const config = setConfigValue(provider, '')
    applyProviderConfig(config)
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
    await Provider.refreshOllamaStatus()
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
    return { keys: masked, available: Provider.availableProviders(), proPlus: isProPlus() }
  })

  ipcMain.handle('config:getOllama', async () => {
    const probe = await Provider.refreshOllamaStatus(true)
    const cfg = loadConfig()
    return {
      enabled: cfg.ollamaEnabled === '1',
      preferOllama: cfg.preferOllama === '1',
      model: cfg.ollamaModel ?? '',
      baseUrl: cfg.ollamaBaseUrl ?? '',
      running: probe.ok,
      models: probe.models,
    }
  })

  ipcMain.handle('config:setOllama', async (_event, patch: {
    enabled?: boolean
    preferOllama?: boolean
    model?: string
    baseUrl?: string
  }) => {
    const cfg = loadConfig()
    if (patch.enabled !== undefined) setConfigValue('ollamaEnabled', patch.enabled ? '1' : '')
    if (patch.preferOllama !== undefined) setConfigValue('preferOllama', patch.preferOllama ? '1' : '')
    if (patch.model !== undefined) setConfigValue('ollamaModel', patch.model.trim())
    if (patch.baseUrl !== undefined) setConfigValue('ollamaBaseUrl', patch.baseUrl.trim())
    applyProviderConfig(loadConfig())
    await Provider.refreshOllamaStatus(true)
    return { success: true, available: Provider.availableProviders(), ...Provider.ollamaStatus() }
  })

  ipcMain.handle('config:testOllama', async () => Provider.testOllama())

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

  // --- Audio / MIDI setup ----------------------------------------------------

  // Enumerate the devices csound can see, so the Settings panel can offer a real
  // dropdown. Best-effort: returns empty lists if csound isn't on PATH.
  ipcMain.handle('config:listAudioDevices', async () => {
    try {
      return await listAudioDevices()
    } catch (err: any) {
      return { outputs: [], inputs: [], midiInputs: [], error: String(err?.message ?? err) }
    }
  })

  // Current selection ('' = system default for output/input; input 'none' = mic off).
  ipcMain.handle('config:getAudioConfig', async () => ({
    output: getConfigValue(AUDIO_OUTPUT_KEY) ?? '',
    input: getConfigValue(AUDIO_INPUT_KEY) ?? '',
    midiInput: getConfigValue(MIDI_INPUT_KEY) ?? '',
  }))

  ipcMain.handle('config:resetAudioDevices', async () => {
    for (const key of AUDIO_KEYS) setConfigValue(key, '')
    return { success: true, output: '', input: '', midiInput: '' }
  })

  // Persist one device field. Output/input: '' = system default; input 'none' = off.
  ipcMain.handle('config:setAudioDevice', async (_event, field: string, value: string) => {
    if (!AUDIO_KEYS.includes(field as (typeof AUDIO_KEYS)[number])) {
      return { success: false, error: `Unknown audio field: ${field}` }
    }
    const v = (value ?? '').trim()
    if (field === AUDIO_INPUT_KEY && v === AUDIO_INPUT_OFF) {
      setConfigValue(field, AUDIO_INPUT_OFF)
      return { success: true }
    }
    if (v && !/^\d+$/.test(v)) return { success: false, error: 'Invalid device index' }
    setConfigValue(field, v)
    return { success: true }
  })

  // Drop saved indices that no longer appear in csound --devices (e.g. unplugged USB).
  ipcMain.handle('config:sanitizeAudioDevices', async () => {
    const devs = await listAudioDevices().catch(() => ({ outputs: [], inputs: [], midiInputs: [] }))
    const out = getConfigValue(AUDIO_OUTPUT_KEY) ?? ''
    const inp = getConfigValue(AUDIO_INPUT_KEY) ?? ''
    const midi = getConfigValue(MIDI_INPUT_KEY) ?? ''
    let changed = false
    if (/^\d+$/.test(out) && !devs.outputs.some((d) => String(d.index) === out)) {
      setConfigValue(AUDIO_OUTPUT_KEY, '')
      changed = true
    }
    if (/^\d+$/.test(inp) && !devs.inputs.some((d) => String(d.index) === inp)) {
      setConfigValue(AUDIO_INPUT_KEY, '')
      changed = true
    }
    if (/^\d+$/.test(midi) && !devs.midiInputs.some((d) => String(d.index) === midi)) {
      setConfigValue(MIDI_INPUT_KEY, '')
      changed = true
    }
    return {
      changed,
      output: getConfigValue(AUDIO_OUTPUT_KEY) ?? '',
      input: getConfigValue(AUDIO_INPUT_KEY) ?? '',
      midiInput: getConfigValue(MIDI_INPUT_KEY) ?? '',
    }
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

  // CsoundQt install path — same pattern as Cabbage.
  ipcMain.handle('config:getCsoundQtPath', async () => {
    const path = getConfigValue('csoundQtPath') ?? ''
    const detected = path ? '' : ((await detectCsoundQtPath()) ?? '')
    return { path, exists: path ? existsSync(path) : false, detected }
  })

  ipcMain.handle('config:setCsoundQtPath', async (_event, path: string) => {
    const trimmed = (path ?? '').trim()
    setConfigValue('csoundQtPath', trimmed)
    return { success: true, path: trimmed, exists: trimmed ? existsSync(trimmed) : false }
  })

  ipcMain.handle('config:detectCsoundQt', async () => {
    return { detected: (await detectCsoundQtPath(true)) ?? '' }
  })

  ipcMain.handle('config:chooseCsoundQtPath', async () => {
    const win = BrowserWindow.getFocusedWindow()
    const options: Electron.OpenDialogOptions = {
      title: 'Choose CsoundQt',
      properties: process.platform === 'darwin' ? ['openFile', 'openDirectory'] : ['openFile'],
      filters: process.platform === 'win32' ? [{ name: 'Executable', extensions: ['exe'] }] : undefined,
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    const chosen = result.filePaths[0]
    setConfigValue('csoundQtPath', chosen)
    return { canceled: false, path: chosen, exists: existsSync(chosen) }
  })
}
