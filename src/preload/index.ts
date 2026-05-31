import { contextBridge, ipcRenderer } from 'electron'

export interface StreamChunk {
  sessionID: string
  type: 'text' | 'tool_call' | 'tool_result' | 'narration' | 'suggestions' | 'error'
  content: string
  toolName?: string
  toolArgs?: Record<string, unknown>
}

export interface StreamResult {
  sessionID: string
  error?: string
}

const api = {
  session: {
    create: (agentName: string) =>
      ipcRenderer.invoke('session:create', agentName),
    send: (sessionID: string, content: string) =>
      ipcRenderer.invoke('session:send', sessionID, content),
    list: () => ipcRenderer.invoke('session:list'),
    get: (id: string) => ipcRenderer.invoke('session:get', id),
  },

  stream: {
    onChunk: (cb: (chunk: StreamChunk) => void) => {
      const handler = (_: any, chunk: StreamChunk) => cb(chunk)
      ipcRenderer.on('stream:chunk', handler)
      return () => ipcRenderer.removeListener('stream:chunk', handler)
    },
    onComplete: (cb: (result: StreamResult) => void) => {
      const handler = (_: any, result: StreamResult) => cb(result)
      ipcRenderer.on('stream:complete', handler)
      return () => ipcRenderer.removeListener('stream:complete', handler)
    },
  },

  csound: {
    writeCsd: (content: string) =>
      ipcRenderer.invoke('csound:writeCsd', content),
    compile: (csdPath: string) =>
      ipcRenderer.invoke('csound:compile', csdPath),
    render: (csdPath: string, opts?: { output?: string }) =>
      ipcRenderer.invoke('csound:render', csdPath, opts),
    play: (csdPath: string) =>
      ipcRenderer.invoke('csound:play', csdPath),
    stop: () => ipcRenderer.invoke('csound:stop'),
    event: (line: string) => ipcRenderer.invoke('csound:event', line),
    setChannel: (name: string, value: number) =>
      ipcRenderer.invoke('csound:setChannel', name, value),
  },

  retrieval: {
    search: (query: string, opts?: Record<string, unknown>) =>
      ipcRenderer.invoke('retrieval:search', query, opts),
    feedback: (chunkID: string, signal: string) =>
      ipcRenderer.invoke('retrieval:feedback', chunkID, signal),
  },

  graph: {
    getData: () => ipcRenderer.invoke('graph:getData'),
    getNode: (id: string) => ipcRenderer.invoke('graph:getNode', id),
    neighbors: (id: string) => ipcRenderer.invoke('graph:neighbors', id),
    ask: (question: string) => ipcRenderer.invoke('graph:ask', question),
  },

  export: {
    html: (sessionID: string, opts: Record<string, unknown>) =>
      ipcRenderer.invoke('export:html', sessionID, opts),
    openInCabbage: (content: string, title: string) =>
      ipcRenderer.invoke('export:openInCabbage', content, title),
    stems: (sessionID: string) =>
      ipcRenderer.invoke('export:stems', sessionID),
    presetPack: (sessionID: string) =>
      ipcRenderer.invoke('export:presetPack', sessionID),
  },

  memory: {
    recall: (query: string) => ipcRenderer.invoke('memory:recall', query),
    save: (type: string, data: unknown) =>
      ipcRenderer.invoke('memory:save', type, data),
    getProfile: () => ipcRenderer.invoke('memory:profile'),
    feedback: (kind: string, payload?: Record<string, unknown>) =>
      ipcRenderer.invoke('memory:feedback', kind, payload ?? {}),
    lessons: () => ipcRenderer.invoke('memory:lessons'),
    deleteLesson: (id: string) => ipcRenderer.invoke('memory:deleteLesson', id),
  },

  config: {
    setApiKey: (provider: string, key: string) =>
      ipcRenderer.invoke('config:setApiKey', provider, key),
    getApiKeys: () => ipcRenderer.invoke('config:getApiKeys'),
    testApiKey: (provider: string) =>
      ipcRenderer.invoke('config:testApiKey', provider),
  },

  llm: {
    adaptCsd: (prompt: string) =>
      ipcRenderer.invoke('llm:adaptCsd', prompt),
  },
}

export type DrcAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
