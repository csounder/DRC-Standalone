import { streamText, generateText } from 'ai'
import { Agent } from '../agent/agent'
import { Provider } from '../provider/provider'
import { Tool } from '../tool/registry'
import { Retrieval } from '../retrieval/engine'
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

    try {
      // Try generateText first to verify model works, then stream
      Log.info('Calling generateText...')
      const genResult = await generateText({
        model: model as any,
        system: systemPrompt,
        messages: aiMessages,
        temperature: agent.temperature,
        topP: agent.topP,
      })

      const fullContent = genResult.text
      Log.info(`generateText finished: ${fullContent.length} chars`)

      // Send the full response in chunks to simulate streaming
      const chunkSize = 40
      for (let i = 0; i < fullContent.length; i += chunkSize) {
        const chunk = fullContent.slice(i, i + chunkSize)
        yield { type: 'text', content: chunk }
        // Small delay for streaming feel
        await new Promise((r) => setTimeout(r, 15))
      }

      Log.info(`Stream finished: ${fullContent.length} chars`)

      // Save assistant response
      session.messages.push({
        id: ascending('message'),
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      })

      Bus.emit('session:message', { sessionID, role: 'assistant', content: fullContent })
    } catch (err: any) {
      Log.error('Stream error:', err.message)
      Log.error('Stack:', err.stack)
      yield { type: 'error', content: `LLM Error: ${err.message}` }
    }
  }
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
