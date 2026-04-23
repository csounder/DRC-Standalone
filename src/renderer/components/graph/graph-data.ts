import Graph from 'graphology'
import { ENTITY_COLORS } from '../../styles/theme'

export interface GraphNode {
  id: string
  type: string
  label: string
  description?: string
  year?: number
  community?: number
  color?: string
  size?: number
}

export interface GraphEdge {
  source: string
  target: string
  type: string
  weight: number
}

export interface ProcessedGraph {
  graph: Graph
  nodes: GraphNode[]
  communities: Map<number, string>
}

export function processGraphData(raw: { nodes: GraphNode[]; edges: GraphEdge[] }): ProcessedGraph {
  const graph = new Graph({ multi: false, type: 'undirected' })

  // Add nodes
  for (const node of raw.nodes) {
    graph.addNode(node.id, {
      label: node.label,
      type: node.type,
      description: node.description,
      year: node.year,
      color: ENTITY_COLORS[node.type] || '#666',
      size: 5,
    })
  }

  // Add edges. Graphology with multi: false rejects a second edge between the
  // same endpoint pair, and our extracted data has ~650 such pairs (different
  // relation types between the same two entities). Skip duplicates by checking
  // the UNDIRECTED endpoint pair, not a type-augmented key.
  for (const edge of raw.edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue
    if (edge.source === edge.target) continue
    if (graph.hasEdge(edge.source, edge.target)) continue
    try {
      graph.addEdge(edge.source, edge.target, {
        type: edge.type,
        weight: edge.weight,
      })
    } catch {
      // Extra belt: swallow anything unexpected so one bad edge can't kill
      // the whole graph.
    }
  }

  // Color + size by entity type and degree. Skipped community detection
  // (Louvain) because it was brittle on isolated nodes and added nothing
  // the type palette doesn't already convey.
  graph.forEachNode((node, attrs) => {
    const degree = graph.degree(node)
    graph.setNodeAttribute(node, 'size', Math.max(5, Math.min(22, 4 + degree * 1.6)))
    graph.setNodeAttribute(node, 'color', ENTITY_COLORS[attrs.type as string] || '#7cb8a4')
    graph.setNodeAttribute(node, 'community', 0)
  })

  const communities = new Map<number, string>([[0, '#7cb8a4']])

  // Build nodes array for external consumers
  const nodes: GraphNode[] = raw.nodes.map((n) => {
    const attrs = graph.getNodeAttributes(n.id)
    return {
      ...n,
      community: 0,
      color: attrs.color as string,
      size: attrs.size as number,
    }
  })

  return { graph, nodes, communities }
}

export function filterGraph(
  processed: ProcessedGraph,
  searchQuery: string,
  activeFilters: Set<string>
): { visibleNodes: Set<string> } {
  const visibleNodes = new Set<string>()
  const query = searchQuery.toLowerCase()

  processed.graph.forEachNode((node, attrs) => {
    const type = attrs.type as string
    if (activeFilters.size > 0 && !activeFilters.has(type)) return

    if (query) {
      const label = (attrs.label as string || '').toLowerCase()
      const desc = (attrs.description as string || '').toLowerCase()
      if (!label.includes(query) && !desc.includes(query)) return
    }

    visibleNodes.add(node)
  })

  return { visibleNodes }
}
