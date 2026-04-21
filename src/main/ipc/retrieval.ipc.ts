import { IpcMain } from 'electron'
import { Retrieval } from '../retrieval/engine'

export function handleRetrievalIPC(ipcMain: IpcMain): void {
  ipcMain.handle('retrieval:search', async (_event, query: string, opts?: { deep?: boolean; maxResults?: number }) => {
    Retrieval.init()
    const results = opts?.deep
      ? Retrieval.deepSearch(query, opts?.maxResults || 12)
      : Retrieval.search(query, opts?.maxResults || 8)
    return results
  })

  ipcMain.handle('retrieval:opcode', async (_event, name: string) => {
    Retrieval.init()
    return Retrieval.lookupOpcode(name)
  })

  ipcMain.handle('retrieval:opcodes', async (_event, query: string) => {
    Retrieval.init()
    return Retrieval.searchOpcodes(query)
  })

  ipcMain.handle('retrieval:feedback', async (_event, _chunkID: string, _signal: string) => {
    // TODO: RLHF feedback scoring
    return { success: true }
  })
}
