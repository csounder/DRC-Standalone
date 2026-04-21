import Graph from 'graphology'
import louvain from 'graphology-communities-louvain'
import { COMMUNITY_COLORS, ENTITY_COLORS } from '../../styles/theme'

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

  // Add edges
  for (const edge of raw.edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      const key = `${edge.source}--${edge.target}`
      if (!graph.hasEdge(key)) {
        graph.addEdgeWithKey(key, edge.source, edge.target, {
          type: edge.type,
          weight: edge.weight,
        })
      }
    }
  }

  // Community detection
  louvain.assign(graph, { resolution: 1.2 })

  // Build community color map
  const communities = new Map<number, string>()
  graph.forEachNode((node, attrs) => {
    const comm = attrs.community as number
    if (!communities.has(comm)) {
      communities.set(comm, COMMUNITY_COLORS[communities.size % COMMUNITY_COLORS.length])
    }
  })

  // Assign sizes based on degree and community colors
  graph.forEachNode((node, attrs) => {
    const degree = graph.degree(node)
    const comm = attrs.community as number
    graph.setNodeAttribute(node, 'size', Math.max(4, Math.min(20, 3 + degree * 1.5)))
    graph.setNodeAttribute(node, 'color', communities.get(comm) || ENTITY_COLORS[attrs.type as string] || '#666')
  })

  // Build nodes array for external consumers
  const nodes: GraphNode[] = raw.nodes.map((n) => {
    const attrs = graph.getNodeAttributes(n.id)
    return {
      ...n,
      community: attrs.community as number,
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
