import { useEffect, useRef, useCallback } from 'react'
import Sigma from 'sigma'
import FA2Layout from 'graphology-layout-forceatlas2/worker'
import type { ProcessedGraph } from './graph-data'

interface Props {
  processed: ProcessedGraph
  visibleNodes: Set<string>
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
}

export default function Graph2D({ processed, visibleNodes, selectedNodeId, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sigmaRef = useRef<Sigma | null>(null)
  const layoutRef = useRef<FA2Layout | null>(null)

  useEffect(() => {
    if (!containerRef.current || !processed.graph.order) return

    // Random initial positions
    processed.graph.forEachNode((node) => {
      if (!processed.graph.getNodeAttribute(node, 'x')) {
        processed.graph.setNodeAttribute(node, 'x', Math.random() * 1000 - 500)
        processed.graph.setNodeAttribute(node, 'y', Math.random() * 1000 - 500)
      }
    })

    const sigma = new Sigma(processed.graph, containerRef.current, {
      renderLabels: true,
      labelFont: 'Inter, system-ui, sans-serif',
      labelSize: 12,
      labelWeight: '500',
      labelColor: { color: '#e6edf3' },
      defaultEdgeColor: 'rgba(255,255,255,0.06)',
      defaultEdgeType: 'line',
      defaultNodeColor: '#58a6ff',
      stagePadding: 50,
      nodeReducer: (node, data) => {
        const res = { ...data }
        if (visibleNodes.size > 0 && !visibleNodes.has(node)) {
          res.hidden = true
        }
        if (selectedNodeId) {
          if (node === selectedNodeId) {
            res.highlighted = true
            res.zIndex = 2
          } else if (processed.graph.hasEdge(node, selectedNodeId) || processed.graph.hasEdge(selectedNodeId, node)) {
            res.zIndex = 1
          } else {
            res.color = mixColor(res.color as string, '#0d1117', 0.65)
            res.label = ''
          }
        }
        return res
      },
      edgeReducer: (edge, data) => {
        const res = { ...data }
        if (selectedNodeId) {
          const src = processed.graph.source(edge)
          const tgt = processed.graph.target(edge)
          if (src !== selectedNodeId && tgt !== selectedNodeId) {
            res.hidden = true
          } else {
            res.color = 'rgba(255,255,255,0.2)'
            res.size = 1.5
          }
        }
        return res
      },
    })

    sigma.on('clickNode', ({ node }) => {
      onSelectNode(node === selectedNodeId ? null : node)
    })

    sigma.on('clickStage', () => {
      onSelectNode(null)
    })

    sigmaRef.current = sigma

    // Start ForceAtlas2 layout
    const layout = new FA2Layout(processed.graph, {
      settings: {
        gravity: 0.05,
        scalingRatio: 4,
        barnesHutOptimize: true,
        slowDown: 5,
        strongGravityMode: false,
      },
    })
    layout.start()
    layoutRef.current = layout

    // Stop layout after convergence
    const stopTimer = setTimeout(() => {
      layout.stop()
    }, 4000)

    return () => {
      clearTimeout(stopTimer)
      layout.stop()
      layout.kill()
      sigma.kill()
      sigmaRef.current = null
      layoutRef.current = null
    }
  }, [processed])

  // Update node reducer when selection/filters change
  useEffect(() => {
    sigmaRef.current?.refresh()
  }, [selectedNodeId, visibleNodes])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        background: '#0d1117',
      }}
    />
  )
}

function mixColor(color: string, bg: string, amount: number): string {
  const parse = (hex: string) => {
    const h = hex.replace('#', '')
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }
  const [r1, g1, b1] = parse(color || '#666666')
  const [r2, g2, b2] = parse(bg)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(mix(r1, r2))}${toHex(mix(g1, g2))}${toHex(mix(b1, b2))}`
}
