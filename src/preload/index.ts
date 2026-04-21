import { contextBridge, ipcRenderer } from 'electron'

export interface StreamChunk {
  sessionID: string
  type: 'text' | 'tool_call' | 'tool_result' | 'narration' | 'error'
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
    liveStart: (sessionID: string, csdPath: string) =>
      ipcRenderer.invoke('csound:live:start', sessionID, csdPath),
    liveChannel: (sessionID: string, ch: string, val: number) =>
      ipcRenderer.invoke('csound:live:channel', sessionID, ch, val),
    liveHotReload: (sessionID: string, orc: string) =>
      ipcRenderer.invoke('csound:live:reload', sessionID, orc),
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
  },

  export: {
    html: (sessionID: string, opts: Record<string, unknown>) =>
      ipcRenderer.invoke('export:html', sessionID, opts),
    cabbage: (sessionID: string, mode: 'vst' | 'standalone') =>
      ipcRenderer.invoke('export:cabbage', sessionID, mode),
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
  },

  config: {
    setApiKey: (provider: string, key: string) =>
      ipcRenderer.invoke('config:setApiKey', provider, key),
    getApiKeys: () => ipcRenderer.invoke('config:getApiKeys'),
  },
}

export type DrcAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
