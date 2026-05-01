import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import type { ProcessedGraph, GraphNode } from './graph-data'
import { useAppStore } from '../../stores/appStore'
import type { Theme } from '../../styles/theme'

interface Props {
  processed: ProcessedGraph
  visibleNodes: Set<string>
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
  highlightedNodes?: Set<string>  // from Ask / semantic search
}

interface CanvasPalette {
  bg: string
  edge: string
  edgeHi: string
  labelPrimary: string
  labelMuted: string
  labelHighlight: string
  labelShadow: string
  selectedFill: string
  highlightFill: string
  highlightHalo: string
  stats: string
  loadingOverlay: string
  loadingText: string
}

const DARK_PALETTE: CanvasPalette = {
  bg: '#0d1117',
  edge: 'rgba(255,255,255,0.05)',
  edgeHi: 'rgba(124,184,164,0.55)',
  labelPrimary: '#e8e6e1',
  labelMuted: 'rgba(200,200,200,0.85)',
  labelHighlight: '#f0b27a',
  labelShadow: 'rgba(13,17,23,0.9)',
  selectedFill: '#7cb8a4',
  highlightFill: '#f0b27a',
  highlightHalo: 'rgba(240,178,122,0.28)',
  stats: '#484f58',
  loadingOverlay: 'rgba(13,17,23,0.6)',
  loadingText: '#8b949e',
}

const LIGHT_PALETTE: CanvasPalette = {
  bg: '#f4f3ee',
  edge: 'rgba(10,10,10,0.08)',
  edgeHi: 'rgba(26,58,42,0.55)',
  labelPrimary: '#0a0a0a',
  labelMuted: 'rgba(40,40,40,0.78)',
  labelHighlight: '#8b6914',
  labelShadow: 'rgba(244,243,238,0.92)',
  selectedFill: '#1a3a2a',
  highlightFill: '#8b6914',
  highlightHalo: 'rgba(139,105,20,0.22)',
  stats: '#8a8884',
  loadingOverlay: 'rgba(244,243,238,0.7)',
  loadingText: '#5a5854',
}

function paletteFor(theme: Theme): CanvasPalette {
  return theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE
}

interface LayoutNode {
  id: string
  x: number
  y: number
  size: number
  color: string
  label: string
  type: string
  description?: string
  year?: number
}

// 2D graph renderer. Uses graphology-layout-forceatlas2 (Barnes-Hut, O(n log n))
// to compute positions ONCE on mount instead of running an n² simulation per
// frame — handles thousands of nodes without hanging the UI.
export default function GraphCanvas({ processed, visibleNodes, selectedNodeId, onSelectNode, highlightedNodes }: Props) {
  const theme = useAppStore((s) => s.theme)
  const palette = useMemo(() => paletteFor(theme), [theme])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<LayoutNode[]>([])
  const edgesRef = useRef<{ source: string; target: string }[]>([])
  // Node ids to always label: the top-N by degree. Everything else only labels
  // on hover or when selected. Keeps a 3k-node graph legible without walls of
  // overlapping text.
  const alwaysLabelRef = useRef<Set<string>>(new Set())
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [layoutReady, setLayoutReady] = useState(false)
  const offsetRef = useRef({ x: 0, y: 0 })
  const scaleRef = useRef(1)
  const dragRef = useRef<{ nodeId: string | null; startX: number; startY: number; panning: boolean }>({
    nodeId: null, startX: 0, startY: 0, panning: false,
  })
  const dirtyRef = useRef(true)

  // Compute layout once on mount (or when the graph changes).
  useEffect(() => {
    if (!processed.graph.order) return
    setLayoutReady(false)

    // Run layout asynchronously so the UI can show a loading state.
    const handle = setTimeout(() => {
      try {
        const N = processed.graph.order
        console.info(`[graph] computing layout for ${N} nodes, ${processed.graph.size} edges`)
        const t0 = performance.now()

        // Seed positions on a circle — FA2 requires non-zero, non-identical coords
        let i = 0
        processed.graph.forEachNode((id) => {
          const theta = (i / N) * Math.PI * 2
          const r = Math.sqrt(N) * 20
          processed.graph.setNodeAttribute(id, 'x', Math.cos(theta) * r + Math.random() * 0.1)
          processed.graph.setNodeAttribute(id, 'y', Math.sin(theta) * r + Math.random() * 0.1)
          i++
        })

        const iterations = N > 2000 ? 200 : N > 500 ? 400 : 600
        forceAtlas2.assign(processed.graph, {
          iterations,
          settings: {
            barnesHutOptimize: N > 400,
            barnesHutTheta: 0.8,
            scalingRatio: 8,
            gravity: 1.2,
            strongGravityMode: true,
            slowDown: 4,
          },
        })

        const nodes: LayoutNode[] = []
        processed.graph.forEachNode((id, attrs) => {
          nodes.push({
            id,
            x: (attrs.x as number) ?? 0,
            y: (attrs.y as number) ?? 0,
            size: (attrs.size as number) || 5,
            color: (attrs.color as string) || '#666',
            label: (attrs.label as string) || id,
            type: (attrs.type as string) || '',
            description: attrs.description as string,
            year: attrs.year as number,
          })
        })

        const edges: { source: string; target: string }[] = []
        processed.graph.forEachEdge((_edge, _attrs, source, target) => {
          edges.push({ source, target })
        })

        // Always-label whitelist: top 40 nodes by degree. Users can still see
        // any node's label by hovering/selecting.
        const degree = new Map<string, number>()
        for (const e of edges) {
          degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
          degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
        }
        const ranked = [...degree.entries()].sort((a, b) => b[1] - a[1])
        alwaysLabelRef.current = new Set(ranked.slice(0, 40).map(([id]) => id))

        nodesRef.current = nodes
        edgesRef.current = edges
        dirtyRef.current = true
        autoFit()
        setLayoutReady(true)
        console.info(`[graph] layout done in ${(performance.now() - t0).toFixed(0)}ms — ${nodes.length} nodes positioned; labeling top ${alwaysLabelRef.current.size} by degree`)
      } catch (err) {
        console.error('[graph] layout failed:', err)
        // Show nodes in their seed positions even if FA2 blew up
        const nodes: LayoutNode[] = []
        processed.graph.forEachNode((id, attrs) => {
          nodes.push({
            id,
            x: (attrs.x as number) ?? Math.random() * 1000 - 500,
            y: (attrs.y as number) ?? Math.random() * 1000 - 500,
            size: (attrs.size as number) || 5,
            color: (attrs.color as string) || '#666',
            label: (attrs.label as string) || id,
            type: (attrs.type as string) || '',
          })
        })
        const edges: { source: string; target: string }[] = []
        processed.graph.forEachEdge((_e, _a, source, target) => edges.push({ source, target }))
        nodesRef.current = nodes
        edgesRef.current = edges
        dirtyRef.current = true
        autoFit()
        setLayoutReady(true)
      }
    }, 50)

    return () => clearTimeout(handle)
  }, [processed])

  const autoFit = useCallback(() => {
    const ns = nodesRef.current
    if (ns.length === 0) return
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of ns) {
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    const graphW = maxX - minX + 100
    const graphH = maxY - minY + 100
    scaleRef.current = Math.min(w / graphW, h / graphH, 2) * 0.85
    offsetRef.current = {
      x: w / 2 - ((minX + maxX) / 2) * scaleRef.current,
      y: h / 2 - ((minY + maxY) / 2) * scaleRef.current,
    }
    dirtyRef.current = true
  }, [])

  // Render loop — draws only when something changed, not every frame.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0

    function render() {
      if (!dirtyRef.current) {
        rafId = requestAnimationFrame(render)
        return
      }
      dirtyRef.current = false

      const dpr = window.devicePixelRatio || 1
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      const scale = scaleRef.current
      const ox = offsetRef.current.x
      const oy = offsetRef.current.y
      const ns = nodesRef.current
      const es = edgesRef.current
      const nodeMap = new Map(ns.map((n) => [n.id, n]))

      // Background
      ctx!.fillStyle = palette.bg
      ctx!.fillRect(0, 0, w, h)

      // Visibility set: keep rendering cheap when filters shrink to a subset
      const visible = visibleNodes.size > 0 ? visibleNodes : null

      // Edges — single pass, pre-computed color
      ctx!.strokeStyle = palette.edge
      ctx!.lineWidth = 0.5
      ctx!.beginPath()
      for (const e of es) {
        if (visible && (!visible.has(e.source) || !visible.has(e.target))) continue
        if (selectedNodeId && e.source !== selectedNodeId && e.target !== selectedNodeId) continue
        const s = nodeMap.get(e.source)
        const t = nodeMap.get(e.target)
        if (!s || !t) continue
        ctx!.moveTo(s.x * scale + ox, s.y * scale + oy)
        ctx!.lineTo(t.x * scale + ox, t.y * scale + oy)
      }
      ctx!.stroke()

      // Highlighted edges (if a node is selected) on top
      if (selectedNodeId) {
        ctx!.strokeStyle = palette.edgeHi
        ctx!.lineWidth = 1.4
        ctx!.beginPath()
        for (const e of es) {
          if (e.source !== selectedNodeId && e.target !== selectedNodeId) continue
          const s = nodeMap.get(e.source)
          const t = nodeMap.get(e.target)
          if (!s || !t) continue
          ctx!.moveTo(s.x * scale + ox, s.y * scale + oy)
          ctx!.lineTo(t.x * scale + ox, t.y * scale + oy)
        }
        ctx!.stroke()
      }

      // Nodes
      const neighbors = selectedNodeId ? collectNeighbors(es, selectedNodeId) : null
      const hi = highlightedNodes && highlightedNodes.size > 0 ? highlightedNodes : null

      for (const n of ns) {
        if (visible && !visible.has(n.id)) continue
        const x = n.x * scale + ox
        const y = n.y * scale + oy
        const r = Math.max(1.5, n.size * scale * 0.5)

        let alpha = 1
        if (selectedNodeId && n.id !== selectedNodeId && (!neighbors || !neighbors.has(n.id))) {
          alpha = 0.12
        } else if (hi && !hi.has(n.id) && n.id !== selectedNodeId && n.id !== hoveredNode) {
          alpha = 0.08
        }

        // Halo for highlighted nodes
        if (hi && hi.has(n.id)) {
          ctx!.beginPath()
          ctx!.arc(x, y, r + 5, 0, Math.PI * 2)
          ctx!.fillStyle = palette.highlightHalo
          ctx!.fill()
        }

        ctx!.globalAlpha = alpha
        ctx!.beginPath()
        ctx!.arc(x, y, r, 0, Math.PI * 2)
        ctx!.fillStyle = n.id === selectedNodeId
          ? palette.selectedFill
          : hi && hi.has(n.id)
            ? palette.highlightFill
            : n.color
        ctx!.fill()
        ctx!.globalAlpha = 1
      }

      // Labels:
      // - No selection: show selected/hovered, the top-N hubs, and highlights.
      // - Selection active: show ONLY the selected node + its direct neighbors
      //   (plus the hover). Hub/highlight labels fade to avoid clutter — the
      //   neighborhood is the focus.
      const whitelist = alwaysLabelRef.current
      ctx!.textAlign = 'center'
      ctx!.font = '500 12px Inter, sans-serif'
      ctx!.shadowColor = palette.labelShadow
      ctx!.shadowBlur = 3
      for (const n of ns) {
        if (visible && !visible.has(n.id)) continue
        const isSel = n.id === selectedNodeId
        const isHover = n.id === hoveredNode
        const isNeighbor = neighbors ? neighbors.has(n.id) : false
        const isHub = whitelist.has(n.id)
        const isHighlight = hi && hi.has(n.id)

        let show = false
        if (selectedNodeId) {
          show = isSel || isHover || isNeighbor
        } else {
          show = isSel || isHover || isHub || !!isHighlight
        }
        if (!show) continue
        const x = n.x * scale + ox
        const y = n.y * scale + oy
        const r = Math.max(1.5, n.size * scale * 0.5)
        ctx!.fillStyle = isSel || isHover
          ? palette.labelPrimary
          : isHighlight ? palette.labelHighlight : palette.labelMuted
        ctx!.font = `${isSel || isHover || isHighlight ? 600 : 500} ${isSel || isHover ? 13 : isHighlight ? 12 : 11}px Inter, sans-serif`
        ctx!.fillText(n.label, x, y + r + 13)
      }
      ctx!.shadowBlur = 0

      // Stats
      ctx!.font = '11px SF Mono, monospace'
      ctx!.fillStyle = palette.stats
      ctx!.textAlign = 'left'
      ctx!.fillText(`${ns.length} nodes · ${es.length} edges${visible ? ` · ${visible.size} visible` : ''}`, 16, h - 12)

      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(rafId)
  }, [visibleNodes, selectedNodeId, hoveredNode, layoutReady, palette])

  // Theme switch — palette changed; trigger a redraw with the new colors.
  useEffect(() => { dirtyRef.current = true }, [palette])

  // Mouse interaction
  const findNodeAt = useCallback((cx: number, cy: number): LayoutNode | null => {
    const scale = scaleRef.current
    const ox = offsetRef.current.x
    const oy = offsetRef.current.y
    let closest: LayoutNode | null = null
    let closestDist = Infinity
    const visible = visibleNodes.size > 0 ? visibleNodes : null

    for (const n of nodesRef.current) {
      if (visible && !visible.has(n.id)) continue
      const x = n.x * scale + ox
      const y = n.y * scale + oy
      const dist = Math.hypot(cx - x, cy - y)
      const hitRadius = Math.max(4, n.size * scale * 0.5 + 4)
      if (dist < hitRadius && dist < closestDist) {
        closest = n
        closestDist = dist
      }
    }
    return closest
  }, [visibleNodes])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const node = findNodeAt(x, y)
    dragRef.current = { nodeId: node?.id || null, startX: e.clientX, startY: e.clientY, panning: !node }
  }, [findNodeAt])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (dragRef.current.panning) {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      offsetRef.current.x += dx
      offsetRef.current.y += dy
      dragRef.current.startX = e.clientX
      dragRef.current.startY = e.clientY
      dirtyRef.current = true
      return
    }

    const node = findNodeAt(x, y)
    const id = node?.id || null
    if (id !== hoveredNode) {
      setHoveredNode(id)
      dirtyRef.current = true
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = node ? 'pointer' : 'grab'
    }
  }, [findNodeAt, hoveredNode])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const moved = Math.abs(e.clientX - dragRef.current.startX) + Math.abs(e.clientY - dragRef.current.startY)
    if (moved < 4) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const node = findNodeAt(x, y)
      onSelectNode(node ? (node.id === selectedNodeId ? null : node.id) : null)
    }
    dragRef.current = { nodeId: null, startX: 0, startY: 0, panning: false }
  }, [findNodeAt, onSelectNode, selectedNodeId])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const newScale = scaleRef.current * factor
    offsetRef.current.x = mx - (mx - offsetRef.current.x) * factor
    offsetRef.current.y = my - (my - offsetRef.current.y) * factor
    scaleRef.current = Math.max(0.05, Math.min(8, newScale))
    dirtyRef.current = true
  }, [])

  // Redraw when props change
  useEffect(() => { dirtyRef.current = true }, [visibleNodes, selectedNodeId, highlightedNodes])

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', background: palette.bg, cursor: 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />
      {!layoutReady && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: palette.loadingOverlay, pointerEvents: 'none',
          color: palette.loadingText, fontSize: 14, fontFamily: 'Inter, sans-serif',
        }}>
          Computing layout…
        </div>
      )}
    </div>
  )
}

function collectNeighbors(edges: { source: string; target: string }[], nodeId: string): Set<string> {
  const s = new Set<string>()
  for (const e of edges) {
    if (e.source === nodeId) s.add(e.target)
    else if (e.target === nodeId) s.add(e.source)
  }
  return s
}
