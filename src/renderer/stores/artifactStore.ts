import { create } from 'zustand'

export type ArtifactType = 'csd' | 'webapp' | 'vst'

export type FileLanguage = 'csd' | 'html' | 'js' | 'css' | 'cabbage'

export interface ArtifactFile {
  name: string
  language: FileLanguage
  content: string
  // Derived files are generated views of the primary file. Read-only.
  derived?: boolean
}

export interface Artifact {
  id: string
  type: ArtifactType
  title: string
  files: ArtifactFile[]
  activeFileIndex: number
  version: number
  timestamp: number
  parentId?: string
  // The assistant message this artifact was derived from. Lets the chat page
  // re-adopt an already-built artifact after it remounts (e.g. navigating away
  // and back) instead of re-deriving a fresh one from the message text — which
  // is wrong for converted web apps whose message holds an orchestra CSD, not
  // the generated HTML.
  sourceMessageId?: string
}

// Which file is the source of truth for each artifact type.
function primaryFileName(type: ArtifactType): string {
  return type === 'webapp' ? 'index.html' : 'main.csd'
}

export function primaryFile(a: Artifact): ArtifactFile {
  const name = primaryFileName(a.type)
  return a.files.find((f) => f.name === name) ?? a.files[0]
}

export function primaryContent(a: Artifact): string {
  return primaryFile(a)?.content ?? ''
}

// Given the raw LLM blob + artifact type, split into named files.
// The primary file stores the full blob; derived files are extracted views.
export function splitIntoFiles(type: ArtifactType, raw: string): ArtifactFile[] {
  if (type === 'csd') {
    return [{ name: 'main.csd', language: 'csd', content: raw }]
  }

  if (type === 'vst') {
    const cabbage = raw.match(/<Cabbage>([\s\S]*?)<\/Cabbage>/)?.[1]?.trim() ?? ''
    const files: ArtifactFile[] = [{ name: 'main.csd', language: 'csd', content: raw }]
    if (cabbage) {
      files.push({ name: 'widgets.cabbage', language: 'cabbage', content: cabbage, derived: true })
    }
    return files
  }

  // webapp
  const files: ArtifactFile[] = [{ name: 'index.html', language: 'html', content: raw }]

  const jsBlocks: string[] = []
  const cssBlocks: string[] = []
  let csd = ''

  // Non-csound, non-external <script> blocks → app.js view
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = scriptRe.exec(raw))) {
    const attrs = m[1] || ''
    const body = (m[2] || '').trim()
    if (!body) continue
    if (/\btype\s*=\s*["']text\/csound["']/i.test(attrs)) {
      csd = body
      continue
    }
    if (/\bsrc\s*=/i.test(attrs)) continue
    jsBlocks.push(body)
  }
  if (jsBlocks.length) {
    files.push({
      name: 'app.js',
      language: 'js',
      content: jsBlocks.join('\n\n// ───\n\n'),
      derived: true,
    })
  }

  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  while ((m = styleRe.exec(raw))) {
    const body = (m[1] || '').trim()
    if (body) cssBlocks.push(body)
  }
  if (cssBlocks.length) {
    files.push({
      name: 'style.css',
      language: 'css',
      content: cssBlocks.join('\n\n/* ─── */\n\n'),
      derived: true,
    })
  }

  if (csd) {
    files.push({ name: 'main.csd', language: 'csd', content: csd, derived: true })
  }

  return files
}

interface ArtifactState {
  artifacts: Artifact[]
  activeArtifactId: string | null
  panelOpen: boolean

  addArtifact: (input: { type: ArtifactType; title: string; content: string; sourceMessageId?: string }) => Artifact
  updatePrimary: (id: string, content: string, sourceMessageId?: string) => Artifact
  updateInPlace: (id: string, content: string) => void
  setActive: (id: string | null) => void
  setActiveFile: (id: string, fileIndex: number) => void
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  getVersions: (id: string) => Artifact[]
  getActive: () => Artifact | null
}

export const useArtifactStore = create<ArtifactState>((set, get) => ({
  artifacts: [],
  activeArtifactId: null,
  panelOpen: false,

  addArtifact: (input) => {
    const existing = get().artifacts
    const sameTitle = existing.filter((a) => a.title === input.title && a.type === input.type)
    const version = sameTitle.length + 1
    const parentId = sameTitle.length > 0 ? sameTitle[sameTitle.length - 1].id : undefined

    const artifact: Artifact = {
      id: `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: input.type,
      title: input.title,
      files: splitIntoFiles(input.type, input.content),
      activeFileIndex: 0,
      version,
      timestamp: Date.now(),
      parentId,
      sourceMessageId: input.sourceMessageId,
    }
    set((s) => ({
      artifacts: [...s.artifacts, artifact],
      activeArtifactId: artifact.id,
      panelOpen: true,
    }))
    return artifact
  },

  updatePrimary: (id, newContent, sourceMessageId) => {
    const existing = get().artifacts.find((a) => a.id === id)
    if (!existing) return existing!

    const artifact: Artifact = {
      ...existing,
      id: `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      files: splitIntoFiles(existing.type, newContent),
      activeFileIndex: existing.activeFileIndex < splitIntoFiles(existing.type, newContent).length
        ? existing.activeFileIndex
        : 0,
      version: existing.version + 1,
      timestamp: Date.now(),
      parentId: id,
      sourceMessageId,
    }
    set((s) => ({
      artifacts: [...s.artifacts, artifact],
      activeArtifactId: artifact.id,
    }))
    return artifact
  },

  updateInPlace: (id, newContent) => set((s) => ({
    artifacts: s.artifacts.map((a) => {
      if (a.id !== id) return a
      const files = splitIntoFiles(a.type, newContent)
      const activeFileIndex = a.activeFileIndex < files.length ? a.activeFileIndex : 0
      return { ...a, files, activeFileIndex }
    }),
  })),

  setActive: (id) => set({ activeArtifactId: id, panelOpen: id !== null }),

  setActiveFile: (id, fileIndex) => set((s) => ({
    artifacts: s.artifacts.map((a) =>
      a.id === id ? { ...a, activeFileIndex: fileIndex } : a,
    ),
  })),

  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  getVersions: (id) => {
    const artifacts = get().artifacts
    const target = artifacts.find((a) => a.id === id)
    if (!target) return []
    return artifacts
      .filter((a) => a.title === target.title && a.type === target.type)
      .sort((a, b) => a.version - b.version)
  },

  getActive: () => {
    const { artifacts, activeArtifactId } = get()
    return artifacts.find((a) => a.id === activeArtifactId) || null
  },
}))
