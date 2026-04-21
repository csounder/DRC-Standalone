import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { ArtifactFile, FileLanguage } from '../../stores/artifactStore'

const MONACO_LANG: Record<FileLanguage, string> = {
  csd: 'csound',
  cabbage: 'csound', // close enough; cabbage widgets sit inside the CSD grammar
  html: 'html',
  js: 'javascript',
  css: 'css',
}

function registerCsoundLanguage(monaco: any) {
  if (monaco.languages.getLanguages().some((l: any) => l.id === 'csound')) return
  monaco.languages.register({ id: 'csound', extensions: ['.csd', '.orc', '.sco'] })
  monaco.languages.setMonarchTokensProvider('csound', {
    keywords: [
      'instr', 'endin', 'opcode', 'endop', 'if', 'then', 'else', 'elseif', 'endif',
      'while', 'do', 'od', 'until', 'goto', 'igoto', 'kgoto',
    ],
    tokenizer: {
      root: [
        [/;.*$/, 'comment'],
        [/<[!\/]?[A-Za-z][A-Za-z0-9]*>/, 'tag'],
        [/\b[akig][A-Za-z_][A-Za-z0-9_]*\b/, 'variable'],
        [/\b(instr|endin|opcode|endop|if|then|else|elseif|endif|while|do|od)\b/, 'keyword'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/\b\d+\.?\d*\b/, 'number'],
      ],
    },
  } as any)
}

interface Props {
  file: ArtifactFile
  onChange?: (content: string) => void
  editable: boolean
}

export default function FileEditor({ file, onChange, editable }: Props) {
  const [value, setValue] = useState(file.content)
  const [dirty, setDirty] = useState(false)
  const originalRef = useRef(file.content)

  useEffect(() => {
    setValue(file.content)
    originalRef.current = file.content
    setDirty(false)
  }, [file])

  const handleMount: OnMount = (_editor, monaco) => {
    registerCsoundLanguage(monaco)
  }

  const handleEdit = (v: string | undefined) => {
    const next = v ?? ''
    setValue(next)
    setDirty(next !== originalRef.current)
  }

  const apply = () => {
    if (!onChange || !dirty) return
    onChange(value)
  }

  const revert = () => {
    setValue(originalRef.current)
    setDirty(false)
  }

  const readOnly = !editable || !onChange

  return (
    <div style={styles.container}>
      <div style={styles.banner}>
        <span style={styles.filename}>{file.name}</span>
        {file.derived && <span style={styles.badge}>derived view · read-only</span>}
        {!file.derived && !editable && <span style={styles.badge}>read-only</span>}
        {dirty && <span style={styles.dirty}>● unsaved</span>}
        <div style={{ flex: 1 }} />
        {dirty && (
          <>
            <button onClick={revert} style={styles.neutralBtn}>Revert</button>
            <button onClick={apply} style={styles.primaryBtn}>Apply · New Version</button>
          </>
        )}
      </div>
      <div style={styles.editorWrap}>
        <Editor
          height="100%"
          language={MONACO_LANG[file.language]}
          value={value}
          onMount={handleMount}
          onChange={handleEdit}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: 'var(--font-mono), SF Mono, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            renderLineHighlight: 'line',
            tabSize: 2,
            wordWrap: 'off',
            padding: { top: 12, bottom: 12 },
          }}
          theme="vs-dark"
        />
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  container: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
  banner: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '6px 14px', borderBottom: '1px solid var(--border-subtle)',
    background: 'var(--bg-secondary)', flexShrink: 0, fontSize: 11,
  },
  filename: { fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 500 },
  badge: {
    fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-tertiary)',
    padding: '1px 7px', borderRadius: 4, letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  dirty: { fontSize: 10, color: 'var(--accent)', fontWeight: 600 },
  neutralBtn: {
    padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text-muted)', fontSize: 11,
    fontFamily: 'var(--font-primary)', cursor: 'pointer',
  },
  primaryBtn: {
    padding: '4px 10px', borderRadius: 6, border: 'none',
    background: 'var(--accent)', color: 'var(--bg-primary)', fontSize: 11,
    fontWeight: 600, fontFamily: 'var(--font-primary)', cursor: 'pointer',
  },
  editorWrap: { flex: 1, minHeight: 0 },
}
