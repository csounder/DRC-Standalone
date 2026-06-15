import { Log } from '../util/log'

export interface OllamaModel {
  name: string
  size?: number
}

const DEFAULT_BASE = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'qwen2.5-coder:7b'

export function ollamaBaseUrl(configured?: string): string {
  const raw = (configured ?? process.env.OLLAMA_HOST ?? '').trim()
  if (!raw) return DEFAULT_BASE
  if (raw.startsWith('http')) return raw.replace(/\/$/, '')
  return `http://${raw.replace(/\/$/, '')}`
}

export async function probeOllama(baseUrl?: string): Promise<{ ok: boolean; models: OllamaModel[]; error?: string }> {
  const url = `${ollamaBaseUrl(baseUrl)}/api/tags`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return { ok: false, models: [], error: `HTTP ${res.status}` }
    const data = (await res.json()) as { models?: { name: string; size?: number }[] }
    const models = (data.models ?? []).map((m) => ({ name: m.name, size: m.size }))
    return { ok: true, models }
  } catch (err: any) {
    Log.warn(`Ollama probe failed: ${err?.message ?? err}`)
    return { ok: false, models: [], error: err?.message ?? 'Ollama not reachable' }
  }
}

export function defaultOllamaModel(models: OllamaModel[], configured?: string): string {
  const want = (configured ?? '').trim()
  if (want && models.some((m) => m.name === want || m.name.startsWith(`${want}:`))) return want
  const coder = models.find((m) => /coder|code|llama|qwen|mistral/i.test(m.name))
  if (coder) return coder.name
  if (models.length) return models[0].name
  return DEFAULT_MODEL
}
