import { streamText } from 'ai'
import { Agent } from '../agent/agent'
import { Provider } from '../provider/provider'
import { Retrieval } from '../retrieval/engine'
import { searchPassages } from '../retrieval/passages'
import { Log } from '../util/log'

// Clean a user query before feeding it to the narrator: strip anything that
// looks like code, CSD tags, compiler errors, or boilerplate so the model
// focuses on the musical topic rather than trying to debug.
function extractTopic(raw: string): string {
  let s = raw
    .replace(/<CsoundSynthesizer>[\s\S]*?<\/CsoundSynthesizer>/gi, '')
    .replace(/<Cabbage>[\s\S]*?<\/Cabbage>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^Compiler error:.*$/gim, '')
    .replace(/^Current CSD:.*$/gim, '')
    .replace(/^The CSD you just wrote failed.*$/gim, '')
    .replace(/error:.*$/gim, '')
    .replace(/Line:\s*\d+/gi, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length > 220) s = s.slice(0, 220)
  return s || raw.slice(0, 100)
}

export namespace NarrationManager {
  const COOLDOWN_MS = 15_000
  const firedMap = new Map<string, number>()

  export function canFire(sessionID: string): boolean {
    const last = firedMap.get(sessionID) ?? 0
    return Date.now() - last >= COOLDOWN_MS
  }

  export function markFired(sessionID: string): void {
    firedMap.set(sessionID, Date.now())
  }

  // Stream historically-grounded narration about the technique/instrument the
  // user is asking about. Pulls passages from the Csound book and (optional)
  // graph entities so the narration references real, citeable context rather
  // than hallucinated lore. Runs in parallel with the main code-generation call.
  export async function* streamNarration(
    userQuery: string,
    csdContext: string = ''
  ): AsyncGenerator<string> {
    const narratorAgent = Agent.get('narrator')
    if (!narratorAgent || !narratorAgent.prompt) {
      Log.warn('Narrator agent not configured')
      return
    }

    // Resolve small/fast model. If nothing is configured, bail gracefully.
    const { providerID, modelID } = Provider.smallModel()
    let model
    try {
      model = Provider.getLanguageModel(providerID, modelID)
    } catch (err: any) {
      Log.warn(`Narration disabled — no model for ${providerID}: ${err.message}`)
      return
    }

    // Strip anything that looks like code, CSD tags, or error output from the
    // user query before it reaches the narrator — otherwise Haiku sometimes
    // decides to help debug instead of providing historical context.
    const topic = extractTopic(userQuery)

    // Pull grounding from the extracted passage index first (cleaner,
    // topic-tagged quotes). Fall back to the raw book search if no passages
    // match — this keeps the old path alive for queries the extractor missed.
    const extracted = searchPassages(topic, 3)
    const bookChunks = extracted.length === 0 ? Retrieval.searchBook(topic, 3) : []
    const exampleChunks = Retrieval.searchExamples(topic, 1)
    const refs: string[] = []
    for (const p of extracted) {
      const tagHint = p.topic_tags.length ? ` tags="${p.topic_tags.slice(0, 3).join(', ')}"` : ''
      refs.push(`<passage source="${p.source_book}"${tagHint}>\n${p.content.slice(0, 900)}\n</passage>`)
    }
    for (const c of bookChunks) {
      refs.push(`<passage source="csound_book">\n${c.content.slice(0, 900)}\n</passage>`)
    }
    for (const ex of exampleChunks) {
      refs.push(`<example id="${ex.id}">\n${ex.content.slice(0, 600)}\n</example>`)
    }
    const grounding = refs.length
      ? `\n\n<grounding>\n${refs.join('\n')}\n</grounding>`
      : ''

    const userContent =
      `Topic: "${topic}"` +
      grounding +
      `\n\nProvide EXACTLY 2-3 sentences of historical/educational context on this topic, grounded in the passages above. Cite a specific composer, instrument, studio, year, or work when the passages support it. NO code. NO CSD. NO emojis. NO markdown. NO bullet points. NO headers. Plain prose only.`

    try {
      const stream = streamText({
        model: model as any,
        system: narratorAgent.prompt,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.6,
      })

      for await (const chunk of stream.textStream) {
        yield chunk
      }
    } catch (err: any) {
      Log.warn(`Narration stream failed: ${err.message}`)
    }
  }
}
