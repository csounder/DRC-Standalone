import { create } from 'zustand'

interface EditorState {
  csdContent: string
  filePath: string | null
  isDirty: boolean
  signalFlow: string | null
  setCsdContent: (content: string) => void
  setFilePath: (path: string | null) => void
  setDirty: (dirty: boolean) => void
  setSignalFlow: (flow: string | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  csdContent: '',
  filePath: null,
  isDirty: false,
  signalFlow: null,

  setCsdContent: (content) => set({ csdContent: content, isDirty: true }),
  setFilePath: (path) => set({ filePath: path }),
  setDirty: (dirty) => set({ isDirty: dirty }),
  setSignalFlow: (flow) => set({ signalFlow: flow }),
}))
