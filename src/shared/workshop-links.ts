/** LAC 2026 workshop URLs — single source for clipboard copy and handout generation. */

export const SETUP_GUIDE = {
  sectionTitle: 'Setup guide',
  linksTitle: 'Install & API key links',
  linksBody:
    'For classes, workshops, and presentations: copy every install URL, API signup link, and local LLM ' +
    'resource — paste into chat, email, or slides for students.',
  copyButton: 'Copy setup links',
  copyButtonDone: 'Copied!',
  handoutOpen: 'Open one-slide handout',
  handoutReveal: 'Show handout in Finder',
  clipboardHeader: 'Dr.C — setup links (install, API keys, local LLM)',
  clipboardPlatforms: 'Platforms: macOS & Linux',
} as const

export interface WorkshopLink {
  label: string
  url: string
}

export interface WorkshopLinkGroup {
  title: string
  links: WorkshopLink[]
}

export const WORKSHOP_HANDOUT_FILENAME = 'LAC-2026-one-slide.pdf'

export const WORKSHOP_LINK_GROUPS: WorkshopLinkGroup[] = [
  {
    title: 'Repos & downloads',
    links: [
      { label: 'Dr.C Standalone (lac-2026-csound7)', url: 'https://github.com/mateolarreaferro/Dr.C-Standalone/tree/lac-2026-csound7' },
      { label: 'Dr.C Standalone releases', url: 'https://github.com/mateolarreaferro/Dr.C-Standalone/releases' },
      { label: 'Dr.C Terminal', url: 'https://github.com/mateolarreaferro/Dr.C' },
      { label: 'Participant guide (PARTICIPANTS.md)', url: 'https://github.com/mateolarreaferro/Dr.C-Standalone/blob/lac-2026-csound7/PARTICIPANTS.md' },
      { label: 'Local LLM guide (LOCAL-LLM.md)', url: 'https://github.com/mateolarreaferro/Dr.C-Standalone/blob/lac-2026-csound7/LOCAL-LLM.md' },
    ],
  },
  {
    title: 'Csound & tools',
    links: [
      { label: 'Csound 7 releases', url: 'https://github.com/csound/csound/releases' },
      { label: 'Csound download', url: 'https://csound.com/download.html' },
      { label: 'FLOSS Manual', url: 'https://flossmanual.csound.com/' },
      { label: 'Opcode index', url: 'https://csound.com/manual/opcodesIndex/' },
      { label: 'CsoundQt 7 releases', url: 'https://github.com/CsoundQt/CsoundQt/releases' },
      { label: 'Node.js 22', url: 'https://nodejs.org/' },
      { label: 'Bun (Terminal)', url: 'https://bun.sh/' },
    ],
  },
  {
    title: 'API keys (Agent)',
    links: [
      { label: 'OpenRouter (one key — recommended)', url: 'https://openrouter.ai/keys' },
      { label: 'OpenRouter credits', url: 'https://openrouter.ai/credits' },
      { label: 'OpenRouter free models', url: 'https://openrouter.ai/models?max_price=0' },
      { label: 'Anthropic (direct)', url: 'https://console.anthropic.com/settings/keys' },
      { label: 'OpenAI (direct)', url: 'https://platform.openai.com/api-keys' },
      { label: 'Groq (free tier)', url: 'https://console.groq.com/keys' },
      { label: 'Google Gemini (free tier)', url: 'https://aistudio.google.com/apikey' },
    ],
  },
  {
    title: 'Local model (no API key)',
    links: [
      { label: 'Ollama download', url: 'https://ollama.com/download' },
      { label: 'Ollama model library', url: 'https://ollama.com/library' },
      { label: 'Default model pull', url: 'https://ollama.com/library/qwen2.5-coder:7b' },
      { label: 'LM Studio (local server)', url: 'https://lmstudio.ai/' },
    ],
  },
  {
    title: 'Dr.C Terminal only',
    links: [
      { label: 'OpenCode Zen models', url: 'https://opencode.ai/docs/zen/' },
      { label: 'Dr.C Terminal GET-STARTED', url: 'https://github.com/mateolarreaferro/Dr.C/blob/main/opencode/GET-STARTED.md' },
    ],
  },
]

/** Plain-text block for clipboard — one URL per line, grouped by section. */
export function formatWorkshopLinksForClipboard(): string {
  const lines = [
    SETUP_GUIDE.clipboardHeader,
    SETUP_GUIDE.clipboardPlatforms,
    '',
  ]
  for (const group of WORKSHOP_LINK_GROUPS) {
    lines.push(`=== ${group.title} ===`)
    for (const { label, url } of group.links) {
      lines.push(`${label}: ${url}`)
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}
