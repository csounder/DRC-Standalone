import { IpcMain } from 'electron'
import { generateText } from 'ai'
// Inline the JSON at bundle time. Runtime file reads through __dirname broke
// because resources/ isn't copied into out/main — bundling sidesteps the whole
// path-resolution problem (same fix as the agent prompts).
import graphJson from '../../../resources/graph/computer-music-history.json'
import { Provider } from '../provider/provider'
import { Log } from '../util/log'

interface GraphNode { id: string; label: string; type: string; description?: string; year?: number; aliases?: string[] }
interface GraphEdge { source: string; target: string; type?: string }

const graphData: { nodes: GraphNode[]; edges: GraphEdge[] } = graphJson as any

function loadGraphData() {
  return graphData
}

// Token-match the question against labels/aliases/descriptions and return the
// top-k candidate nodes. Feeds a manageable slice to the LLM instead of dumping
// all 3000 nodes.
function prefilterNodes(question: string, k = 80): GraphNode[] {
  const terms = question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
  if (terms.length === 0) return []

  const scored: { node: GraphNode; score: number }[] = []
  for (const n of graphData.nodes) {
    const label = (n.label || '').toLowerCase()
    const desc = (n.description || '').toLowerCase()
    const aliases = (n.aliases || []).map((a) => a.toLowerCase()).join(' ')
    const hay = `${label} ${desc} ${aliases}`
    let score = 0
    for (const t of terms) {
      if (label.includes(t)) score += 4
      if (aliases.includes(t)) score += 3
      const matches = hay.split(t).length - 1
      if (matches > 0) score += Math.log2(1 + matches)
    }
    if (score > 0) scored.push({ node: n, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, k).map((s) => s.node)
}

async function askQuestion(question: string): Promise<{ answer: string; nodeIds: string[] }> {
  const candidates = prefilterNodes(question, 80)
  if (candidates.length === 0) {
    return { answer: 'No matching nodes found in the knowledge base.', nodeIds: [] }
  }

  // Tiny index for the LLM — id, label, type, and a truncated description.
  const index = candidates
    .map((n) => `${n.id} [${n.type}] ${n.label}: ${(n.description || '').slice(0, 160)}`)
    .join('\n')

  const { providerID, modelID } = Provider.smallModel()
  let model
  try {
    model = Provider.getLanguageModel(providerID, modelID)
  } catch (err: any) {
    return { answer: `Model unavailable: ${err.message}`, nodeIds: [] }
  }

  const system = `You answer questions about a computer-music knowledge base and select the relevant nodes.

You receive a user question and a shortlist of candidate nodes pre-filtered by keyword match. Pick the ones most relevant to the question — prioritize direct subjects, key related people/orgs/concepts, and tight second-order links.

Respond with ONE JSON object, no prose, no markdown:
{
  "answer": "A 1-2 sentence prose answer. Plain text, no markdown, no emojis. Mention specific people, places, and years when the data supports them.",
  "node_ids": ["id1", "id2", ...]
}

Rules:
- node_ids: MUST be taken verbatim from the candidate list. Do not invent ids.
- Return between 3 and 15 ids — the core set the user should see highlighted.
- If the candidates don't actually answer the question, return {"answer":"...", "node_ids":[]} and say so honestly.`

  const user = `Question: ${question}\n\nCandidates:\n${index}`

  try {
    const { text } = await generateText({
      model: model as any,
      system,
      messages: [{ role: 'user', content: user }],
      temperature: 0.2,
      maxTokens: 600,
    })
    return parseAskResponse(text, new Set(candidates.map((n) => n.id)))
  } catch (err: any) {
    Log.warn(`graph:ask LLM error: ${err.message}`)
    return { answer: `Error: ${err.message}`, nodeIds: [] }
  }
}

function parseAskResponse(raw: string, validIds: Set<string>): { answer: string; nodeIds: string[] } {
  const stripped = raw.trim()
    .replace(/^```(?:json)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
  const jsonMatch = stripped.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { answer: raw.slice(0, 300), nodeIds: [] }
  try {
    const obj = JSON.parse(jsonMatch[0])
    const answer = typeof obj.answer === 'string' ? obj.answer : ''
    const ids = Array.isArray(obj.node_ids) ? obj.node_ids.filter((i: any) => typeof i === 'string' && validIds.has(i)) : []
    return { answer, nodeIds: ids }
  } catch {
    return { answer: raw.slice(0, 300), nodeIds: [] }
  }
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

  ipcMain.handle('graph:ask', async (_event, question: string) => {
    const q = String(question ?? '').trim()
    if (!q) return { answer: '', nodeIds: [] }
    Log.info(`graph:ask → "${q.slice(0, 80)}"`)
    return askQuestion(q)
  })
}
