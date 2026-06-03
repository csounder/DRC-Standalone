import { generateText } from 'ai'
import { Provider } from '../provider/provider'
import { MemoryStore } from './store'
import { Bus } from '../util/bus'
import { Log } from '../util/log'

// When the user thumbs-DOWN a generation and explains WHY, distill that critique
// into ONE durable, actionable rule the agent should apply going forward — then
// store it as a remembered instruction so it frames every future generation
// (same surfaced block as the rules captured from chat). This turns a one-click
// negative signal into concrete, reusable guidance instead of an opaque -1.
//
// Best-effort, background, on the small/cheap model — same shape as Lessons.

const CRITIQUE_SYSTEM = `A user just rejected (thumbs-down) a Csound sound-design generation and explained what was wrong. You see the user's reason and an excerpt of what was generated.

Write ONE precise, general rule that, applied to FUTURE generations, would address this complaint — phrased as a forward-looking imperative instruction the model can implement in Csound, not a comment about this one piece.

Make abstract complaints concrete by naming the synthesis mechanism, because a terse restatement gets interpreted loosely and ignored. Examples:
- reason "Too generic" -> "Avoid plain single-oscillator patches. Add character: detuned/unison voices, an evolving filter or LFO, and a short modulated reverb or delay so timbres have movement."
- reason "Wrong sound" + "too harsh and bright" -> "Default to a softer spectrum: roll off highs with a lowpass around 3-6 kHz, lower modulation index on FM, and avoid raw saw/square without filtering."
- reason "Errors / would not play" -> derive the likely Csound cause if visible (e.g. rate mismatch, missing out) and state the correct pattern.
- "the reverb was too washy" -> "Keep reverb feedback moderate (<=0.85) and wet level around 0.2-0.3 unless the user asks for a long tail."

Only emit a rule if the critique implies a GENERAL, reusable preference. If it is a vague or one-off reaction with no durable takeaway ("meh", "didn't like it", "wrong"), reply with exactly: NONE.
Keep it under 240 characters, imperative, no preamble.`

export namespace FeedbackLessons {
  export async function fromCritique(e: {
    reason?: string | null
    critique?: string | null
    content?: string | null
    sessionId?: string | null
  }): Promise<void> {
    try {
      const reason = (e.reason ?? '').trim()
      const critique = (e.critique ?? '').trim()
      if (!reason && critique.length < 3) return // nothing to learn from a bare -1
      if (!Provider.isConfigured()) return

      const { providerID, modelID } = Provider.smallModel()
      const model = Provider.getLanguageModel(providerID, modelID)
      const user =
        `Reason: ${reason || '(none selected)'}\n` +
        `Details: ${critique || '(none)'}\n\n` +
        (e.content ? `Generated (excerpt):\n${e.content.slice(0, 1500)}` : '')

      const { text } = await generateText({
        model: model as any,
        system: CRITIQUE_SYSTEM,
        messages: [{ role: 'user', content: user }],
        temperature: 0,
        maxTokens: 140,
      })

      const rule = text.trim().replace(/^["'`]|["'`]$/g, '').trim()
      if (!rule || /^none\b/i.test(rule) || rule.length > 320) return

      const id = MemoryStore.saveLesson(rule, e.sessionId ?? null)
      if (id) {
        Bus.emit('memory:lessons-updated')
        Log.info(`memory: learned from thumbs-down — "${rule.slice(0, 80)}"`)
      }
    } catch (err: any) {
      Log.warn(`feedback lesson distill failed: ${err?.message}`)
    }
  }
}
