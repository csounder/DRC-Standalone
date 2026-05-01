import type { Theme } from '../../styles/theme'

let registered = false

export function registerEditorThemes(monaco: any): void {
  if (registered) return
  registered = true

  monaco.editor.defineTheme('drc-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'tag', foreground: '7cb8a4', fontStyle: 'bold' },
      { token: 'comment', foreground: '484f58', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c5a3d9', fontStyle: 'bold' },
      { token: 'keyword.control', foreground: 'c5a3d9' },
      { token: 'keyword.header', foreground: 'f0b27a', fontStyle: 'bold' },
      { token: 'string', foreground: 'a8d5a2' },
      { token: 'number', foreground: 'f4a6a0' },
      { token: 'operator', foreground: '8b949e' },
      { token: 'variable', foreground: '7eb8da' },
      { token: 'variable.rate', foreground: '7eb8da' },
      { token: 'variable.krate', foreground: '58a6ff' },
      { token: 'variable.global', foreground: 'D4748A' },
      { token: 'variable.pfield', foreground: 'f0b27a' },
      { token: 'function.table', foreground: '3D8B8B' },
      { token: 'function.instr', foreground: '5B8C5A' },
    ],
    colors: {
      'editor.background': '#111110',
      'editor.foreground': '#e8e6e1',
      'editor.lineHighlightBackground': '#1a191822',
      'editor.selectionBackground': '#7cb8a425',
      'editorCursor.foreground': '#7cb8a4',
      'editorLineNumber.foreground': '#2a2926',
      'editorLineNumber.activeForeground': '#6a6864',
      'editor.inactiveSelectionBackground': '#7cb8a415',
      'editorIndentGuide.background': '#1f1e1d',
      'editorIndentGuide.activeBackground': '#2a2926',
    },
  })

  monaco.editor.defineTheme('drc-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'tag', foreground: '1a3a2a', fontStyle: 'bold' },
      { token: 'comment', foreground: '8a8884', fontStyle: 'italic' },
      { token: 'keyword', foreground: '6b3a8a', fontStyle: 'bold' },
      { token: 'keyword.control', foreground: '6b3a8a' },
      { token: 'keyword.header', foreground: '8b6914', fontStyle: 'bold' },
      { token: 'string', foreground: '2d5a2d' },
      { token: 'number', foreground: '8b3030' },
      { token: 'operator', foreground: '5a5854' },
      { token: 'variable', foreground: '2c5d80' },
      { token: 'variable.rate', foreground: '2c5d80' },
      { token: 'variable.krate', foreground: '1f4f8a' },
      { token: 'variable.global', foreground: 'a04050' },
      { token: 'variable.pfield', foreground: '8b6914' },
      { token: 'function.table', foreground: '1f5a5a' },
      { token: 'function.instr', foreground: '3a6a3a' },
    ],
    colors: {
      'editor.background': '#faf9f6',
      'editor.foreground': '#0a0a0a',
      'editor.lineHighlightBackground': '#eeedea88',
      'editor.selectionBackground': '#1a3a2a22',
      'editorCursor.foreground': '#1a3a2a',
      'editorLineNumber.foreground': '#c0bdb4',
      'editorLineNumber.activeForeground': '#5a5854',
      'editor.inactiveSelectionBackground': '#1a3a2a14',
      'editorIndentGuide.background': '#e8e6df',
      'editorIndentGuide.activeBackground': '#d0cdc4',
    },
  })
}

export function monacoThemeFor(theme: Theme): string {
  return theme === 'light' ? 'drc-light' : 'drc-dark'
}
