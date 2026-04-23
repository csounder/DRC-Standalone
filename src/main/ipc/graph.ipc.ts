import { IpcMain } from 'electron'
// Inline the JSON at bundle time. Runtime file reads through __dirname broke
// because resources/ isn't copied into out/main — bundling sidesteps the whole
// path-resolution problem (same fix as the agent prompts).
import graphJson from '../../../resources/graph/computer-music-history.json'
import { Log } from '../util/log'

const graphData: { nodes: any[]; edges: any[] } = graphJson as any

function loadGraphData(): { nodes: any[]; edges: any[] } {
  return graphData
}

export function handleGraphIPC(ipcMain: IpcMain): void {
  Log.info(`graph.ipc: bundled graph has ${graphData?.nodes?.length ?? 0} nodes, ${graphData?.edges?.length ?? 0} edges`)

  ipcMain.handle('graph:getData', async () => {
    Log.info(`graph:getData → returning ${graphData?.nodes?.length ?? 0} nodes`)
    return loadGraphData()
  })

  ipcMain.handle('graph:getNode', async (_event, id: string) => {
    const data = loadGraphData()
    return data.nodes.find((n: any) => n.id === id) || null
  })

  ipcMain.handle('graph:neighbors', async (_event, id: string) => {
    const data = loadGraphData()
    const connectedEdges = data.edges.filter(
      (e: any) => e.source === id || e.target === id
    )
    const neighborIds = new Set(
      connectedEdges.map((e: any) => (e.source === id ? e.target : e.source))
    )
    const neighbors = data.nodes.filter((n: any) => neighborIds.has(n.id))
    return { edges: connectedEdges, neighbors }
  })
}
