import { streamText } from 'ai'
import { Agent } from '../agent/agent'
import { Provider } from '../provider/provider'
import { Tool } from '../tool/registry'
import { Retrieval } from '../retrieval/engine'
import { NarrationManager } from './narration'
import { ascending } from '../util/id'
import { Log } from '../util/log'
import { Bus } from '../util/bus'

export interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface Session {
  id: string
  agentName: string
  messages: SessionMessage[]
  createdAt: number
}

const sessions = new Map<string, Session>()

export namespace SessionManager {
  export function create(agentName: string): Session {
    const id = ascending('session')
    const session: Session = {
      id,
      agentName,
      messages: [],
      createdAt: Date.now(),
    }
    sessions.set(id, session)
    Log.info(`Session created: ${id} (${agentName})`)
    return session
  }

  export function get(id: string): Session | undefined {
    return sessions.get(id)
  }

  export function list(): Session[] {
    return Array.from(sessions.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  export async function* send(
    sessionID: string,
    content: string
  ): AsyncGenerator<{ type: string; content: string; toolName?: string }> {
    const session = sessions.get(sessionID)
    if (!session) {
      yield { type: 'error', content: `Session not found: ${sessionID}` }
      return
    }

    const agent = Agent.get(session.agentName)
    if (!agent) {
      yield { type: 'error', content: `Agent not found: ${session.agentName}` }
      return
    }

    // Add user message
    session.messages.push({
      id: ascending('message'),
      role: 'user',
      content,
      timestamp: Date.now(),
    })

    // Initialize RAG and build context
    Retrieval.init()
    const ragContext = Agent.isSineMode(agent) ? '' : Retrieval.formatForPrompt(content)
    const systemPrompt = buildSystemPrompt(agent, ragContext)

    // Resolve model
    const resolvedModel = agent.model
      ? agent.model
      : Agent.isSineMode(agent)
        ? Provider.smallModel()
        : Provider.defaultProvider()

    Log.info(`Using model: ${resolvedModel.providerID}/${resolvedModel.modelID}`)

    let model
    try {
      model = Provider.getLanguageModel(resolvedModel.providerID, resolvedModel.modelID)
    } catch (err: any) {
      Log.error('Model load error:', err.message)
      yield { type: 'error', content: err.message }
      return
    }

    // Convert session history to AI SDK format
    const aiMessages = session.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    Log.info(`Streaming with ${aiMessages.length} messages, system prompt ${systemPrompt.length} chars`)

    // Kick off narration + main stream in parallel. A shared queue lets whichever
    // emits first reach the caller first, and chunks interleave naturally.
    type StreamChunk = { type: string; content: string; toolName?: string }
    const queue: StreamChunk[] = []
    let mainDone = false
    let narrationDone = false
    let wake: (() => void) | null = null
    const ready = () => new Promise<void>((r) => { wake = r })
    const push = (c: StreamChunk) => { queue.push(c); wake?.(); wake = null }

    // Narration — best effort, grounded in the book index. Suppressed for
    // internal autofix turns, where the prompt is full of error text + CSD
    // and would push the narrator off-script.
    const isAutofix = /^The CSD you just wrote failed to compile\b/.test(content)
    const lastCsd = lastAssistantCsd(session)
    if (!isAutofix && NarrationManager.canFire(sessionID)) {
      NarrationManager.markFired(sessionID)
      ;(async () => {
        try {
          for await (const chunk of NarrationManager.streamNarration(content, lastCsd)) {
            push({ type: 'narration', content: chunk })
          }
        } catch (err: any) {
          Log.warn(`Narration error: ${err.message}`)
        } finally {
          narrationDone = true
          wake?.()
        }
      })()
    } else {
      // Either cooldown or autofix — nothing to stream.
      narrationDone = true
    }

    // Main response stream.
    let fullContent = ''
    ;(async () => {
      try {
        Log.info('Starting streamText...')
        const stream = streamText({
          model: model as any,
          system: systemPrompt,
          messages: aiMessages,
          temperature: agent.temperature,
          topP: agent.topP,
        })
        for await (const chunk of stream.textStream) {
          fullContent += chunk
          push({ type: 'text', content: chunk })
        }
      } catch (err: any) {
        Log.error('Stream error:', err.message)
        push({ type: 'error', content: `LLM Error: ${err.message}` })
      } finally {
        mainDone = true
        wake?.()
      }
    })()

    while (!mainDone || !narrationDone || queue.length > 0) {
      if (queue.length === 0) {
        await ready()
        continue
      }
      yield queue.shift()!
    }

    Log.info(`Stream finished: ${fullContent.length} chars`)

    if (fullContent) {
      session.messages.push({
        id: ascending('message'),
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      })
      Bus.emit('session:message', { sessionID, role: 'assistant', content: fullContent })
    }
  }
}

// Pull the most recent assistant-authored CSD content so narration has real
// context about what the user has been building, not just their latest prompt.
function lastAssistantCsd(session: Session): string {
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const m = session.messages[i]
    if (m.role !== 'assistant') continue
    const match = m.content.match(/<CsoundSynthesizer>[\s\S]*?<\/CsoundSynthesizer>/i)
    if (match) return match[0]
  }
  return ''
}

function buildSystemPrompt(agent: Agent.Info, ragContext: string = ''): string {
  const parts: string[] = []

  if (agent.prompt) {
    parts.push(agent.prompt)
  }

  if (ragContext) {
    parts.push(`<retrieved-knowledge>
${ragContext}
</retrieved-knowledge>`)
  }

  parts.push(`<environment>
- Platform: ${process.platform}
- Csound: Available via CLI
- Session mode: ${agent.options?.sineMode ? 'Sine' : agent.options?.sketchMode ? 'Sketch' : 'Complex'}
</environment>

<artifacts>
You can create three types of artifacts. The user's UI auto-detects them from your output and renders them as interactive panels (like Claude's artifacts).

1. **CSD Instrument** — Output a complete \`<CsoundSynthesizer>...<\/CsoundSynthesizer>\` block. The UI will auto-play it and show it as an editable artifact with Play/Stop controls.

2. **Web App** — When the user asks for a web app, output a complete HTML document starting with \`<!DOCTYPE html>\`. Embed the CSD in a \`<script type="text/csound">\` tag and use \`@csound/browser\` from CDN. The UI will render it in a live iframe preview. Include interactive controls (knobs, buttons, keyboard) styled with a dark theme.

3. **VST Plugin** — When the user asks for a VST/AU plugin, output a CSD with a \`<Cabbage>\` section before \`<CsoundSynthesizer>\`. Auto-generate Cabbage widgets (rslider, combobox, keyboard) mapped to the k-rate parameters. The UI will show the plugin configuration.

Always output the full artifact code — never truncate or use placeholders. When the user asks to "make it a web app" or "export as VST", transform the current CSD into that format.
</artifacts>`)

  return parts.join('\n\n')
}
