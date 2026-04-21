import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModelV1 } from 'ai'
import { Log } from '../util/log'

interface ProviderConfig {
  anthropicKey?: string
  openaiKey?: string
  googleKey?: string
}

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
        const google = createGoogleGenerativeAI({ apiKey })
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
}
