import { create } from 'zustand'

export type GraphMode = '2d' | '3d'

interface GraphState {
  mode: GraphMode
  selectedNodeId: string | null
  searchQuery: string
  activeFilters: Set<string>
  setMode: (mode: GraphMode) => void
  selectNode: (id: string | null) => void
  setSearchQuery: (query: string) => void
  toggleFilter: (type: string) => void
}

export const useGraphStore = create<GraphState>((set, get) => ({
  mode: '2d',
  selectedNodeId: null,
  searchQuery: '',
  activeFilters: new Set(),

  setMode: (mode) => set({ mode }),
  selectNode: (id) => set({ selectedNodeId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleFilter: (type) => {
    const filters = new Set(get().activeFilters)
    if (filters.has(type)) {
      filters.delete(type)
    } else {
      filters.add(type)
    }
    set({ activeFilters: filters })
  },
}))
