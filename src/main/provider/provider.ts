import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, type LanguageModelV1 } from 'ai'
import { Log } from '../util/log'

interface ProviderConfig {
  anthropicKey?: string
  openaiKey?: string
  googleKey?: string
}

// Free AI Studio keys resolve against the Gemini Developer API. Pin it so an
// SDK default change can't silently re-point us at v1 or Vertex.
const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

let config: ProviderConfig = {}
const modelCache = new Map<string, LanguageModelV1>()

export namespace Provider {
  export function configure(cfg: ProviderConfig) {
    config = { ...config, ...cfg }
    modelCache.clear()
  }

  export function getLanguageModel(providerID: string, modelID: string): LanguageModelV1 {
    const cacheKey = `${providerID}:${modelID}`
    if (modelCache.has(cacheKey)) return modelCache.get(cacheKey)!

    let model: LanguageModelV1

    switch (providerID) {
      case 'google': {
        const apiKey = config.googleKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY
        if (!apiKey) throw new Error('Google AI API key not configured. Get a free key at https://aistudio.google.com/apikey and set it in Settings.')
        const google = createGoogleGenerativeAI({ apiKey, baseURL: GOOGLE_BASE_URL })
        model = google(modelID) as unknown as LanguageModelV1
        break
      }
      case 'anthropic': {
        const apiKey = config.anthropicKey || process.env.ANTHROPIC_API_KEY
        if (!apiKey) throw new Error('Anthropic API key not configured. Set it in Settings.')
        const anthropic = createAnthropic({ apiKey })
        model = anthropic(modelID) as unknown as LanguageModelV1
        break
      }
      case 'openai': {
        const apiKey = config.openaiKey || process.env.OPENAI_API_KEY
        if (!apiKey) throw new Error('OpenAI API key not configured. Set it in Settings.')
        const openai = createOpenAI({ apiKey })
        model = openai(modelID) as unknown as LanguageModelV1
        break
      }
      default:
        throw new Error(`Unknown provider: ${providerID}. Supported: google, anthropic, openai`)
    }

    modelCache.set(cacheKey, model)
    Log.info(`Loaded model ${providerID}/${modelID}`)
    return model
  }

  // Check which providers are available
  export function availableProviders(): string[] {
    const available: string[] = []
    if (config.googleKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) available.push('google')
    if (config.anthropicKey || process.env.ANTHROPIC_API_KEY) available.push('anthropic')
    if (config.openaiKey || process.env.OPENAI_API_KEY) available.push('openai')
    return available
  }

  export function isConfigured(): boolean {
    return availableProviders().length > 0
  }

  // Gemini 2.5 Flash is free — always prefer it as the default.
  // Anthropic and OpenAI are available as fallbacks if no Google key is set,
  // or when the user explicitly picks a different provider elsewhere.
  export function defaultProvider(): { providerID: string; modelID: string } {
    if (config.googleKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) {
      return { providerID: 'google', modelID: 'gemini-2.5-flash' }
    }
    if (config.anthropicKey || process.env.ANTHROPIC_API_KEY) {
      return { providerID: 'anthropic', modelID: 'claude-sonnet-4-5' }
    }
    if (config.openaiKey || process.env.OPENAI_API_KEY) {
      return { providerID: 'openai', modelID: 'gpt-4.1' }
    }
    return { providerID: 'google', modelID: 'gemini-2.5-flash' }
  }

  // Small/fast model for narration, summaries, sine mode.
  export function smallModel(): { providerID: string; modelID: string } {
    if (config.googleKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY) {
      return { providerID: 'google', modelID: 'gemini-2.5-flash' }
    }
    if (config.anthropicKey || process.env.ANTHROPIC_API_KEY) {
      return { providerID: 'anthropic', modelID: 'claude-haiku-4-5' }
    }
    if (config.openaiKey || process.env.OPENAI_API_KEY) {
      return { providerID: 'openai', modelID: 'gpt-4.1-mini' }
    }
    return { providerID: 'google', modelID: 'gemini-2.5-flash' }
  }

  export function humanizeError(providerID: string, err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err)
    const lower = raw.toLowerCase()

    if (providerID === 'google') {
      if (lower.includes('api_key_invalid') || lower.includes('api key not valid')) {
        return 'Invalid Gemini API key. Get a free one at aistudio.google.com/apikey.'
      }
      if (lower.includes('is not found for api version') || (lower.includes('not found') && lower.includes('model'))) {
        return 'This Gemini model is not available on the free Gemini Developer API. Use a gemini-2.5-* model, or check that the key is from aistudio.google.com (not Vertex AI).'
      }
      if (lower.includes('permission_denied') || lower.includes('permission denied')) {
        return 'Permission denied. The key may be a Vertex AI credential — the free tier needs a key from aistudio.google.com/apikey.'
      }
      if (lower.includes('resource_exhausted') || lower.includes('quota')) {
        return 'Gemini quota exhausted. Wait a minute or check your limits at aistudio.google.com.'
      }
    }

    if (providerID === 'anthropic') {
      if (lower.includes('authentication') || lower.includes('invalid x-api-key') || lower.includes('invalid api key')) {
        return 'Invalid Anthropic API key. Check it at console.anthropic.com/settings/keys.'
      }
      if (lower.includes('credit balance') || lower.includes('insufficient')) {
        return 'Anthropic account is out of credits.'
      }
    }

    if (providerID === 'openai') {
      if (lower.includes('invalid_api_key') || lower.includes('incorrect api key')) {
        return 'Invalid OpenAI API key. Check it at platform.openai.com/api-keys.'
      }
      if (lower.includes('insufficient_quota') || lower.includes('exceeded your current quota')) {
        return 'OpenAI account is out of quota.'
      }
    }

    // Fall back to the first line of the raw message so we don't dump a stack.
    const firstLine = raw.split('\n')[0].trim()
    return firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine
  }

  export async function testApiKey(providerID: string): Promise<{ ok: boolean; message: string }> {
    try {
      const { modelID } = pickTestModel(providerID)
      const model = getLanguageModel(providerID, modelID)
      await generateText({ model, prompt: 'ping', maxTokens: 1 })
      return { ok: true, message: `${providerID} key works (${modelID}).` }
    } catch (err) {
      return { ok: false, message: humanizeError(providerID, err) }
    }
  }

  function pickTestModel(providerID: string): { modelID: string } {
    switch (providerID) {
      case 'google': return { modelID: 'gemini-2.5-flash' }
      case 'anthropic': return { modelID: 'claude-haiku-4-5' }
      case 'openai': return { modelID: 'gpt-4.1-mini' }
      default: throw new Error(`Unknown provider: ${providerID}`)
    }
  }
}
