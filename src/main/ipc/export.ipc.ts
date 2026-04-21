import { IpcMain } from 'electron'

export function handleExportIPC(ipcMain: IpcMain): void {
  ipcMain.handle('export:html', async (_event, _sessionID: string, _opts: any) => {
    // TODO: Port HTML export from opencode csound_export_html_template.ts
    return { success: false, error: 'Not yet implemented' }
  })

  ipcMain.handle('export:cabbage', async (_event, _sessionID: string, _mode: string) => {
    // TODO: Port Cabbage export from opencode csound_export_cabbage.ts
    return { success: false, error: 'Not yet implemented' }
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
