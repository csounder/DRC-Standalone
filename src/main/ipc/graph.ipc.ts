import { IpcMain } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

let graphData: { nodes: any[]; edges: any[] } | null = null

function loadGraphData(): { nodes: any[]; edges: any[] } {
  if (graphData) return graphData

  const graphPath = join(__dirname, '../../resources/graph/computer-music-history.json')
  if (existsSync(graphPath)) {
    graphData = JSON.parse(readFileSync(graphPath, 'utf-8'))
  } else {
    graphData = { nodes: [], edges: [] }
  }
  return graphData!
}

export function handleGraphIPC(ipcMain: IpcMain): void {
  ipcMain.handle('graph:getData', async () => {
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
