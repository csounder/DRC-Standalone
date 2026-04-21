import type { CSSProperties } from 'react'
import type { GraphNode } from './graph-data'
import { ENTITY_COLORS } from '../../styles/theme'

interface Props {
  node: GraphNode
  neighbors: GraphNode[]
  onSelectNode: (id: string | null) => void
  onClose: () => void
}

export default function NodeDetail({ node, neighbors, onSelectNode, onClose }: Props) {
  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={{ ...styles.badge, background: ENTITY_COLORS[node.type] || '#666' }}>
          {node.type.replace('_', ' ')}
        </span>
        <button onClick={onClose} style={styles.closeBtn}>×</button>
      </div>

      <h2 style={styles.name}>{node.label}</h2>
      {node.year && <span style={styles.year}>{node.year}</span>}
      {node.description && <p style={styles.desc}>{node.description}</p>}

      {neighbors.length > 0 && (
        <>
          <h3 style={styles.sectionTitle}>Connections ({neighbors.length})</h3>
          <div style={styles.connections}>
            {neighbors.map((n) => (
              <button
                key={n.id}
                onClick={() => onSelectNode(n.id)}
                style={styles.connectionItem}
              >
                <span
                  style={{
                    ...styles.dot,
                    background: ENTITY_COLORS[n.type] || '#666',
                  }}
                />
                <span style={styles.connectionLabel}>{n.label}</span>
                <span style={styles.connectionType}>{n.type.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  panel: {
    width: 320,
    height: '100%',
    background: '#161b22',
    borderLeft: '1px solid #21262d',
    padding: 24,
    overflow: 'auto',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badge: {
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    color: '#fff',
    textTransform: 'capitalize',
    letterSpacing: '0.03em',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid #30363d',
    background: 'transparent',
    color: '#8b949e',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  name: {
    fontSize: 20,
    fontWeight: 500,
    color: '#e6edf3',
    marginBottom: 4,
    lineHeight: 1.3,
  },
  year: {
    fontSize: 13,
    color: '#484f58',
    fontFamily: 'var(--font-mono)',
    display: 'block',
    marginBottom: 12,
  },
  desc: {
    fontSize: 13,
    color: '#8b949e',
    lineHeight: 1.6,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#484f58',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 10,
    paddingTop: 16,
    borderTop: '1px solid #21262d',
  },
  connections: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  connectionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    transition: 'background 150ms ease',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  connectionLabel: {
    fontSize: 13,
    color: '#e6edf3',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  connectionType: {
    fontSize: 10,
    color: '#484f58',
    textTransform: 'capitalize',
    flexShrink: 0,
  },
}
