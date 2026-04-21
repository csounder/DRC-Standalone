import { useEffect, useRef, useCallback, useMemo } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import type { ProcessedGraph, GraphNode } from './graph-data'

interface Props {
  processed: ProcessedGraph
  visibleNodes: Set<string>
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
  width: number
  height: number
}

export default function Graph3D({ processed, visibleNodes, selectedNodeId, onSelectNode, width, height }: Props) {
  const fgRef = useRef<any>(null)

  const graphData = useMemo(() => {
    const nodes: any[] = []
    const links: any[] = []

    processed.graph.forEachNode((id, attrs) => {
      if (visibleNodes.size > 0 && !visibleNodes.has(id)) return
      nodes.push({
        id,
        label: attrs.label,
        type: attrs.type,
        description: attrs.description,
        year: attrs.year,
        color: attrs.color,
        size: attrs.size,
        community: attrs.community,
      })
    })

    const nodeSet = new Set(nodes.map((n) => n.id))
    processed.graph.forEachEdge((edge, attrs, source, target) => {
      if (nodeSet.has(source) && nodeSet.has(target)) {
        links.push({ source, target, type: attrs.type, weight: attrs.weight })
      }
    })

    return { nodes, links }
  }, [processed, visibleNodes])

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('charge')?.strength(-80)
      fgRef.current.d3Force('link')?.distance(60)
      setTimeout(() => fgRef.current?.zoomToFit(800, 50), 1500)
    }
  }, [graphData])

  const nodeColor = useCallback(
    (node: any) => {
      if (!selectedNodeId) return node.color || '#58a6ff'
      if (node.id === selectedNodeId) return '#58a6ff'
      const isNeighbor = graphData.links.some(
        (l: any) =>
          (l.source?.id || l.source) === selectedNodeId && (l.target?.id || l.target) === node.id ||
          (l.target?.id || l.target) === selectedNodeId && (l.source?.id || l.source) === node.id
      )
      if (isNeighbor) return node.color || '#58a6ff'
      return '#1a1d24'
    },
    [selectedNodeId, graphData.links]
  )

  const nodeOpacity = useCallback(
    (node: any) => {
      if (!selectedNodeId) return 0.9
      if (node.id === selectedNodeId) return 1
      return 0.15
    },
    [selectedNodeId]
  )

  const linkColor = useCallback(
    (link: any) => {
      if (!selectedNodeId) return 'rgba(255,255,255,0.05)'
      const src = link.source?.id || link.source
      const tgt = link.target?.id || link.target
      if (src === selectedNodeId || tgt === selectedNodeId) return 'rgba(88,166,255,0.4)'
      return 'rgba(255,255,255,0.02)'
    },
    [selectedNodeId]
  )

  return (
    <ForceGraph3D
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor="#080b12"
      nodeLabel={(node: any) =>
        `<div style="background:#161b22;padding:8px 12px;border-radius:8px;border:1px solid #30363d;font-family:Inter,sans-serif;font-size:12px;color:#e6edf3;max-width:250px">
          <div style="font-weight:600;margin-bottom:2px">${node.label}</div>
          <div style="font-size:10px;color:#8b949e;text-transform:capitalize">${node.type?.replace('_', ' ')}</div>
          ${node.description ? `<div style="font-size:11px;color:#8b949e;margin-top:4px;line-height:1.3">${node.description.slice(0, 120)}${node.description.length > 120 ? '...' : ''}</div>` : ''}
        </div>`
      }
      nodeColor={nodeColor}
      nodeOpacity={nodeOpacity}
      nodeVal={(node: any) => (node.size || 5) * 0.6}
      linkColor={linkColor}
      linkWidth={0.5}
      linkOpacity={0.6}
      onNodeClick={(node: any) => {
        onSelectNode(node.id === selectedNodeId ? null : node.id)
        if (fgRef.current && node.id !== selectedNodeId) {
          fgRef.current.cameraPosition(
            { x: node.x + 80, y: node.y + 40, z: node.z + 80 },
            { x: node.x, y: node.y, z: node.z },
            800
          )
        }
      }}
      onBackgroundClick={() => onSelectNode(null)}
      enableNodeDrag={true}
      cooldownTicks={150}
      warmupTicks={80}
    />
  )
}
