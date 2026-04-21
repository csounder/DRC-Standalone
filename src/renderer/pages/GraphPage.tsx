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

  // Load graph data from public dir
  useEffect(() => {
    fetch('/computer-music-history.json')
      .then((r) => r.json())
      .then(setRawData)
      .catch((err) => console.error('Failed to load graph data:', err))
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

      {/* Graph + detail */}
      <div style={styles.viewport}>
        {processed ? (
          <GraphCanvas
            processed={processed}
            visibleNodes={visibleNodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={selectNode}
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
}
