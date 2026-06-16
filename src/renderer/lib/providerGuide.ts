/** Shared copy + helpers for API provider setup and free-tier limits. */

export interface ProviderOption {
  id: 'google' | 'groq' | 'anthropic' | 'openai'
  label: string
  /** Short badge, e.g. "Free tier" */
  tier: string
  free: boolean
  signupUrl: string
  signupLabel: string
  keyPlaceholder: string
  hint: string
  /** When this is the only configured provider */
  soloWarning: string
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    id: 'groq',
    label: 'Groq',
    tier: 'Free tier',
    free: true,
    signupUrl: 'https://console.groq.com/keys',
    signupLabel: 'console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    hint: 'Recommended for workshops. Free, no credit card. Dr.C uses Llama 3.3 70B on Groq.',
    soloWarning:
      'Groq\'s free tier has rate limits (~30 requests/minute). If Dr.C pauses, wait for the countdown on the Agent tab, then use Try again. Web Apps work with no key at all.',
  },
  {
    id: 'google',
    label: 'Google AI (Gemini)',
    tier: 'Pro+ only',
    free: false,
    signupUrl: 'https://aistudio.google.com/apikey',
    signupLabel: 'aistudio.google.com/apikey',
    keyPlaceholder: 'AIza...',
    hint: 'Pro+ only — optional for narration and specialist consults. Free Gemini is disabled for Agent.',
    soloWarning: '',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    tier: 'Paid credits',
    free: false,
    signupUrl: 'https://console.anthropic.com/settings/keys',
    signupLabel: 'console.anthropic.com',
    keyPlaceholder: 'sk-ant-...',
    hint: 'Paid API credits required. Strong for Complex mode when you have a budget.',
    soloWarning: '',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    tier: 'Paid credits',
    free: false,
    signupUrl: 'https://platform.openai.com/api-keys',
    signupLabel: 'platform.openai.com',
    keyPlaceholder: 'sk-...',
    hint: 'Paid API credits required.',
    soloWarning: '',
  },
]

export function providerOption(id: string): ProviderOption | undefined {
  return PROVIDER_OPTIONS.find((p) => p.id === id)
}

/** True when the user only has free-tier providers configured (typical workshop attendee). */
export function isFreeTierOnly(available: string[]): boolean {
  if (available.length === 0) return false
  return available.every((id) => {
    const p = providerOption(id)
    return p?.free === true
  })
}

/** True when only one provider is configured and it is a free tier. */
export function isSoloFreeProvider(available: string[]): boolean {
  if (available.length !== 1) return false
  const p = providerOption(available[0])
  return p?.free === true
}

const QUOTA_RE =
  /quota|rate limit|429|resource_exhausted|returned no output|exceeded your current/i

export function isQuotaError(message: string): boolean {
  return QUOTA_RE.test(message)
}

/** Parse suggested retry delay from provider error text; default 60s. */
export function parseQuotaRetryMs(message: string): number {
  const msMatch = message.match(/retry in (\d+(?:\.\d+)?)\s*ms/i)
  if (msMatch) return Math.max(1000, Math.ceil(parseFloat(msMatch[1])))
  const secMatch = message.match(/retry in (\d+(?:\.\d+)?)\s*s(?:ec)?/i)
  if (secMatch) return Math.max(1000, Math.ceil(parseFloat(secMatch[1]) * 1000))
  const waitSec = message.match(/wait (\d+) seconds?/i)
  if (waitSec) return parseInt(waitSec[1], 10) * 1000
  const waitMin = message.match(/wait (\d+) minute/i)
  if (waitMin) return parseInt(waitMin[1], 10) * 60_000
  return 60_000
}

export function formatCountdown(msRemaining: number): string {
  const totalSec = Math.max(0, Math.ceil(msRemaining / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`
}
