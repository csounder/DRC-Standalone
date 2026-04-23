import { useState, useEffect, useMemo, type CSSProperties } from 'react'
import { useGraphStore } from '../stores/graphStore'
import { ENTITY_COLORS } from '../styles/theme'
import { processGraphData, filterGraph, type ProcessedGraph, type GraphNode } from '../components/graph/graph-data'
import GraphCanvas from '../components/graph/GraphCanvas'
import NodeDetail from '../components/graph/NodeDetail'

const ENTITY_TYPES = [
  'person', 'organization', 'place', 'concept',
  'artwork', 'technology', 'event', 'time_period',
]

export default function GraphPage() {
  const { selectedNodeId, selectNode, searchQuery, setSearchQuery, activeFilters, toggleFilter } = useGraphStore()
  const [rawData, setRawData] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] })
  const [processed, setProcessed] = useState<ProcessedGraph | null>(null)

  const [askQuery, setAskQuery] = useState('')
  const [asking, setAsking] = useState(false)
  const [askAnswer, setAskAnswer] = useState<string>('')
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())

  const runAsk = async () => {
    const q = askQuery.trim()
    if (!q || asking) return
    const api = (window as any).api
    if (!api?.graph?.ask) return
    setAsking(true)
    setAskAnswer('')
    try {
      const res = await api.graph.ask(q)
      setAskAnswer(res?.answer ?? '')
      const ids: string[] = Array.isArray(res?.nodeIds) ? res.nodeIds : []
      setHighlighted(new Set(ids))
      // Auto-open the first highlighted node in the side panel for context
      if (ids.length > 0) selectNode(ids[0])
    } catch (err: any) {
      setAskAnswer(`Error: ${err.message}`)
    }
    setAsking(false)
  }

  const clearAsk = () => {
    setAskQuery('')
    setAskAnswer('')
    setHighlighted(new Set())
  }

  // Load graph data via IPC (electron-vite doesn't serve /resources from the dev
  // server, so a plain fetch always 404'd on this file).
  useEffect(() => {
    const api = (window as any).api
    if (!api?.graph?.getData) {
      console.warn('graph IPC not available — running outside Electron?')
      return
    }
    api.graph.getData()
      .then(setRawData)
      .catch((err: any) => console.error('Failed to load graph data:', err))
  }, [])

  useEffect(() => {
    if (rawData.nodes.length > 0) {
      try {
        setProcessed(processGraphData(rawData))
      } catch (err) {
        console.error('Failed to process graph:', err)
      }
    }
  }, [rawData])

  const visibleNodes = useMemo(() => {
    if (!processed) return new Set<string>()
    return filterGraph(processed, searchQuery, activeFilters).visibleNodes
  }, [processed, searchQuery, activeFilters])

  const selectedNode = useMemo(() => {
    if (!processed || !selectedNodeId) return null
    return processed.nodes.find((n) => n.id === selectedNodeId) || null
  }, [processed, selectedNodeId])

  const neighbors = useMemo(() => {
    if (!processed || !selectedNodeId) return []
    const result: GraphNode[] = []
    try {
      processed.graph.forEachNeighbor(selectedNodeId, (neighbor, attrs) => {
        result.push({
          id: neighbor,
          type: attrs.type as string,
          label: attrs.label as string,
          description: attrs.description as string,
          year: attrs.year as number,
          community: attrs.community as number,
          color: attrs.color as string,
          size: attrs.size as number,
        })
      })
    } catch {}
    return result.sort((a, b) => (b.size || 0) - (a.size || 0))
  }, [processed, selectedNodeId])

  return (
    <div style={styles.container}>
      {/* Controls */}
      <div style={styles.controls}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search composers, techniques, institutions..."
          style={styles.search}
        />
        <div style={styles.filters}>
          {ENTITY_TYPES.map((type) => {
            const active = activeFilters.size === 0 || activeFilters.has(type)
            return (
              <button
                key={type}
                onClick={() => toggleFilter(type)}
                style={{
                  ...styles.chip,
                  opacity: active ? 1 : 0.35,
                  borderColor: active ? (ENTITY_COLORS[type] + '80') : '#30363d',
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: ENTITY_COLORS[type], display: 'inline-block' }} />
                <span>{type.replace('_', ' ')}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Ask row */}
      <div style={styles.askRow}>
        <input
          type="text"
          value={askQuery}
          onChange={(e) => setAskQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runAsk() } }}
          placeholder="Ask: e.g. who invented FM synthesis? where did granular synthesis come from?"
          style={styles.askInput}
          disabled={asking}
        />
        <button onClick={runAsk} disabled={asking || !askQuery.trim()} style={styles.askBtn}>
          {asking ? 'Thinking…' : 'Ask'}
        </button>
        {(askAnswer || highlighted.size > 0) && (
          <button onClick={clearAsk} style={styles.askClear}>Clear</button>
        )}
        {askAnswer && <div style={styles.askAnswer}>{askAnswer}</div>}
      </div>

      {/* Graph + detail */}
      <div style={styles.viewport}>
        {processed ? (
          <GraphCanvas
            processed={processed}
            visibleNodes={visibleNodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={selectNode}
            highlightedNodes={highlighted}
          />
        ) : (
          <div style={styles.loading}>
            <p style={{ color: '#8b949e', fontSize: 14 }}>Loading knowledge graph...</p>
          </div>
        )}

        {selectedNode && (
          <NodeDetail
            node={selectedNode}
            neighbors={neighbors}
            onSelectNode={selectNode}
            onClose={() => selectNode(null)}
          />
        )}
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: { height: '100%', display: 'flex', flexDirection: 'column', background: '#0d1117' },
  controls: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
    borderBottom: '1px solid #1e2228', flexWrap: 'wrap',
  },
  search: {
    width: 260, padding: '7px 12px', borderRadius: 8, border: '1px solid #30363d',
    background: '#161b22', color: '#e6edf3', fontSize: 13, fontFamily: 'var(--font-primary)', outline: 'none',
  },
  filters: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  chip: {
    display: 'flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 10,
    border: '1px solid #30363d', background: 'transparent', color: '#8b949e',
    fontSize: 11, cursor: 'pointer', transition: 'opacity 150ms', textTransform: 'capitalize' as const,
    fontFamily: 'var(--font-primary)',
  },
  viewport: { flex: 1, display: 'flex', overflow: 'hidden' },
  loading: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },

  askRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
    borderBottom: '1px solid #1e2228', flexWrap: 'wrap',
  },
  askInput: {
    flex: '1 1 380px', minWidth: 280, padding: '7px 12px', borderRadius: 8,
    border: '1px solid #30363d', background: '#161b22', color: '#e6edf3',
    fontSize: 13, fontFamily: 'var(--font-primary)', outline: 'none',
  },
  askBtn: {
    padding: '7px 16px', borderRadius: 8, border: '1px solid #7cb8a4',
    background: 'transparent', color: '#7cb8a4', fontSize: 12, fontWeight: 600,
    fontFamily: 'var(--font-primary)', cursor: 'pointer',
  },
  askClear: {
    padding: '7px 12px', borderRadius: 8, border: '1px solid #30363d',
    background: 'transparent', color: '#8b949e', fontSize: 12,
    fontFamily: 'var(--font-primary)', cursor: 'pointer',
  },
  askAnswer: {
    flex: '1 1 100%', padding: '10px 14px', borderRadius: 8,
    background: 'rgba(240,178,122,0.06)',
    border: '1px solid rgba(240,178,122,0.25)',
    color: '#e6edf3', fontSize: 13, lineHeight: 1.55,
    fontFamily: 'var(--font-primary)',
  },
}
