import { app, BrowserWindow, shell } from 'electron'
import { join, resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllIPC } from './ipc/register'

// Prevent GPU crashes in Electron
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu-sandbox')

// In dev, load API keys from the repo's .env so the app works out of the box.
// In packaged builds, keys come from config.json (written by Settings page) or system env.
function loadDotenv(): void {
  if (!is.dev) return
  // app.getAppPath() in dev points to drc-app; .env lives at the repo root one level up.
  const candidates = [
    resolve(app.getAppPath(), '..', '.env'),
    resolve(app.getAppPath(), '.env'),
    resolve(process.cwd(), '.env'),
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    try {
      for (const line of readFileSync(path, 'utf-8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
        if (!m) continue
        const [, key, raw] = m
        if (process.env[key]) continue
        process.env[key] = raw.replace(/^['"]|['"]$/g, '')
      }
      return
    } catch {}
  }
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#111110',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  loadDotenv()
  electronApp.setAppUserModelId('com.drc.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerAllIPC()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { mainWindow }
