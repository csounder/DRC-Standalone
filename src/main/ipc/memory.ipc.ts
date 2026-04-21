import { IpcMain } from 'electron'

export function handleMemoryIPC(ipcMain: IpcMain): void {
  ipcMain.handle('memory:recall', async (_event, _query: string) => {
    // TODO: Port memory recall from opencode memory/store.ts
    return { results: [] }
  })

  ipcMain.handle('memory:save', async (_event, _type: string, _data: any) => {
    // TODO: Port memory save from opencode memory/store.ts
    return { success: true }
  })

  ipcMain.handle('memory:profile', async () => {
    // TODO: Port user profile from opencode retrieval/user-profile.ts
    return {
      expertiseLevel: 'intermediate',
      preferredTechniques: {},
      narrationDepth: 'medium',
    }
  })
}
