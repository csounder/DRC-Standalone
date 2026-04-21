import { useRef, useEffect, useCallback, useState } from 'react'
import type { ProcessedGraph, GraphNode } from './graph-data'
import { ENTITY_COLORS } from '../../styles/theme'

interface Props {
  processed: ProcessedGraph
  visibleNodes: Set<string>
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
}

interface LayoutNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  label: string
  type: string
  description?: string
  year?: number
}

// Simple force-directed layout — no WebGL, pure Canvas2D
export default function GraphCanvas({ processed, visibleNodes, selectedNodeId, onSelectNode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<LayoutNode[]>([])
  const edgesRef = useRef<{ source: string; target: string }[]>([])
  const animRef = useRef<number>(0)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const scaleRef = useRef(1)
  const dragRef = useRef<{ nodeId: string | null; startX: number; startY: number; panning: boolean }>({ nodeId: null, startX: 0, startY: 0, panning: false })

  // Initialize layout
  useEffect(() => {
    if (!processed.graph.order) return

    const nodes: LayoutNode[] = []
    processed.graph.forEachNode((id, attrs) => {
      nodes.push({
        id,
        x: (Math.random() - 0.5) * 600,
        y: (Math.random() - 0.5) * 600,
        vx: 0,
        vy: 0,
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

    nodesRef.current = nodes
    edgesRef.current = edges

    // Run force simulation
    let iteration = 0
    const maxIter = 300

    function simulate() {
      const ns = nodesRef.current
      const nodeMap = new Map(ns.map((n) => [n.id, n]))

      // Repulsion between all nodes
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x
          const dy = ns[j].y - ns[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 800 / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          ns[i].vx -= fx
          ns[i].vy -= fy
          ns[j].vx += fx
          ns[j].vy += fy
        }
      }

      // Attraction along edges
      for (const e of edgesRef.current) {
        const s = nodeMap.get(e.source)
        const t = nodeMap.get(e.target)
        if (!s || !t) continue
        const dx = t.x - s.x
        const dy = t.y - s.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = dist * 0.005
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        s.vx += fx
        s.vy += fy
        t.vx -= fx
        t.vy -= fy
      }

      // Gravity toward center
      for (const n of ns) {
        n.vx -= n.x * 0.001
        n.vy -= n.y * 0.001
      }

      // Apply velocity with damping
      const damping = 0.85 - (iteration / maxIter) * 0.3
      for (const n of ns) {
        n.vx *= damping
        n.vy *= damping
        n.x += n.vx
        n.y += n.vy
      }

      iteration++
      if (iteration < maxIter) {
        requestAnimationFrame(simulate)
      }
    }

    simulate()

    // Auto-fit after initial layout
    setTimeout(() => {
      autoFit()
    }, 500)

    return () => { iteration = maxIter }
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
  }, [])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function render() {
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
      const nodeMap = new Map(ns.map((n) => [n.id, n]))

      // Background
      ctx!.fillStyle = '#0d1117'
      ctx!.fillRect(0, 0, w, h)

      // Edges
      ctx!.lineWidth = 0.5
      for (const e of edgesRef.current) {
        const s = nodeMap.get(e.source)
        const t = nodeMap.get(e.target)
        if (!s || !t) continue
        if (visibleNodes.size > 0 && (!visibleNodes.has(s.id) || !visibleNodes.has(t.id))) continue

        if (selectedNodeId) {
          if (e.source !== selectedNodeId && e.target !== selectedNodeId) continue
          ctx!.strokeStyle = 'rgba(88,166,255,0.35)'
          ctx!.lineWidth = 1.2
        } else {
          ctx!.strokeStyle = 'rgba(255,255,255,0.06)'
          ctx!.lineWidth = 0.5
        }

        ctx!.beginPath()
        ctx!.moveTo(s.x * scale + ox, s.y * scale + oy)
        ctx!.lineTo(t.x * scale + ox, t.y * scale + oy)
        ctx!.stroke()
      }

      // Nodes
      for (const n of ns) {
        if (visibleNodes.size > 0 && !visibleNodes.has(n.id)) continue

        const x = n.x * scale + ox
        const y = n.y * scale + oy
        const r = n.size * scale * 0.35

        let alpha = 1
        let color = n.color
        if (selectedNodeId && n.id !== selectedNodeId) {
          // Check if neighbor
          const isNeighbor = edgesRef.current.some(
            (e) => (e.source === selectedNodeId && e.target === n.id) ||
                   (e.target === selectedNodeId && e.source === n.id)
          )
          if (!isNeighbor) alpha = 0.12
        }

        // Glow for selected
        if (n.id === selectedNodeId) {
          ctx!.beginPath()
          ctx!.arc(x, y, r + 4, 0, Math.PI * 2)
          ctx!.fillStyle = 'rgba(88,166,255,0.2)'
          ctx!.fill()
          color = '#58a6ff'
        }

        // Hover glow
        if (n.id === hoveredNode && n.id !== selectedNodeId) {
          ctx!.beginPath()
          ctx!.arc(x, y, r + 3, 0, Math.PI * 2)
          ctx!.fillStyle = 'rgba(255,255,255,0.1)'
          ctx!.fill()
        }

        ctx!.globalAlpha = alpha
        ctx!.beginPath()
        ctx!.arc(x, y, r, 0, Math.PI * 2)
        ctx!.fillStyle = color
        ctx!.fill()

        // Label (only for larger nodes or selected/hovered)
        if (r * scale > 2.5 || n.id === selectedNodeId || n.id === hoveredNode || scale > 0.8) {
          ctx!.font = `500 ${Math.max(9, 11 * scale)}px Inter, sans-serif`
          ctx!.fillStyle = `rgba(230,237,243,${alpha * 0.85})`
          ctx!.textAlign = 'center'
          ctx!.fillText(n.label, x, y + r + 12 * scale)
        }
        ctx!.globalAlpha = 1
      }

      // Stats
      ctx!.font = '11px SF Mono, monospace'
      ctx!.fillStyle = '#484f58'
      ctx!.textAlign = 'left'
      ctx!.fillText(`${ns.length} nodes · ${edgesRef.current.length} edges`, 16, h - 12)

      animRef.current = requestAnimationFrame(render)
    }

    animRef.current = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animRef.current)
  }, [visibleNodes, selectedNodeId, hoveredNode])

  // Mouse interaction
  const findNodeAt = useCallback((cx: number, cy: number): LayoutNode | null => {
    const scale = scaleRef.current
    const ox = offsetRef.current.x
    const oy = offsetRef.current.y
    let closest: LayoutNode | null = null
    let closestDist = Infinity

    for (const n of nodesRef.current) {
      if (visibleNodes.size > 0 && !visibleNodes.has(n.id)) continue
      const x = n.x * scale + ox
      const y = n.y * scale + oy
      const dist = Math.sqrt((cx - x) ** 2 + (cy - y) ** 2)
      const hitRadius = n.size * scale * 0.35 + 6
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
      return
    }

    const node = findNodeAt(x, y)
    setHoveredNode(node?.id || null)
    if (canvasRef.current) {
      canvasRef.current.style.cursor = node ? 'pointer' : 'grab'
    }
  }, [findNodeAt])

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
    scaleRef.current = Math.max(0.1, Math.min(5, newScale))
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', background: '#0d1117' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    />
  )
}
