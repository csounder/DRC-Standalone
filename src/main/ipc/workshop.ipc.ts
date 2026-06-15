import { IpcMain } from 'electron'
import { listWorkshopStarters, readWorkshopStarter, WORKSHOP_STARTERS } from '../util/workshop-starters'

export function handleWorkshopIPC(ipcMain: IpcMain): void {
  ipcMain.handle('workshop:list', async () => listWorkshopStarters())

  ipcMain.handle('workshop:read', async (_event, id: string) => {
    const meta = WORKSHOP_STARTERS.find((s) => s.id === id)
    if (!meta) return { ok: false, error: 'Unknown workshop starter' }
    const content = readWorkshopStarter(meta.filename)
    if (!content) return { ok: false, error: `Missing file: ${meta.filename}` }
    return { ok: true, meta, content }
  })
}
