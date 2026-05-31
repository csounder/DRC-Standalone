import { generateText } from 'ai'
import { Provider } from '../provider/provider'
import { MemoryStore } from './store'
import { Bus } from '../util/bus'
import { Log } from '../util/log'

// Detects when a user turn states a DURABLE preference/rule the assistant should
// apply to future requests (across all sessions) — as opposed to a one-off ask —
// and stores it as a remembered instruction. Runs best-effort in the background
// off the main response, on the small/cheap model.

// Cheap gate so we don't burn a model call on every turn. Only messages that
// look like they're stating a rule get sent to the extractor.
const RULE_CUES =
  /\b(always|never|from now on|next time|whenever|each time|going forward|remember|prefer|i like|i want|should (be|make|use|always|never|sound|stay)|make (it|them|all|every)|don'?t|do not|by default|in general)\b/i

const EXTRACT_SYSTEM = `You monitor a chat with a Csound sound-design assistant.
Decide if the user's latest message states a DURABLE preference or standing rule the assistant should apply to FUTURE requests — not just a one-off instruction for the current piece.

Durable (capture): "always use reverbsc", "when I ask for a granular cloud texture make it tonal", "I prefer long decays", "never let it clip", "by default keep pieces under 30s".
One-off (ignore): "make a granular pad", "add more reverb to this one", "louder", "now make it darker".

If durable, reply with ONE concise imperative rule under 140 characters, no preamble.
If not durable, reply with exactly: NONE`

export namespace Lessons {
  export async function maybeCapture(
    userText: string,
    sessionId: string | null,
  ): Promise<void> {
    try {
      if (!userText || userText.length < 8) return
      if (!RULE_CUES.test(userText)) return
      if (!Provider.isConfigured()) return

      const { providerID, modelID } = Provider.smallModel()
      const model = Provider.getLanguageModel(providerID, modelID)
      const { text } = await generateText({
        model: model as any,
        system: EXTRACT_SYSTEM,
        messages: [{ role: 'user', content: userText }],
        temperature: 0,
        maxTokens: 60,
      })

      const rule = text.trim().replace(/^["'`]|["'`]$/g, '').trim()
      if (!rule || /^none\b/i.test(rule)) return
      if (rule.length > 200) return // guard against the model rambling

      const id = MemoryStore.saveLesson(rule, sessionId)
      if (id) Bus.emit('memory:lessons-updated')
    } catch (err: any) {
      Log.warn(`lesson capture failed: ${err?.message}`)
    }
  }
}
