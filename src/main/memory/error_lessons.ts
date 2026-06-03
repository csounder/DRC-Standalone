import { generateText } from 'ai'
import { Provider } from '../provider/provider'
import { MemoryStore } from './store'
import { Bus } from '../util/bus'
import { Log } from '../util/log'

// Turns a successful autofix (a broken→fixed CSD pair) into ONE durable,
// actionable "avoidance rule" the agent can apply BEFORE making the same mistake
// again. This is the learning half of the error→fix memory: saveErrorFix keeps the
// raw pair for reactive reuse on similar errors; this distills the takeaway so the
// proactive <previous-errors> block can steer every future generation.
//
// Best-effort, background, on the small/cheap model — same shape as Lessons.

const DISTILL_SYSTEM = `You analyze a Csound CSD that FAILED to compile or run and the corrected version that worked.
Write ONE precise, general rule that would have PREVENTED the original error — phrased as a forward-looking instruction the model can apply to future CSDs, not a description of this one fix.

Make it concrete: name the opcode, rate, or construct involved and the correct pattern. Generalize away from this specific patch (don't reference variable names like "kModRatio" — say the class of mistake).

Examples of the transformation:
- error "Unable to find opcode entry for 'linsegr' with matching argument types" -> "linsegr/expsegr accept only i-rate time and value arguments. Read any envelope parameter (including the sustain level) with the i-rate form of chnget (i-prefixed), never k-rate."
- error "INIT ERROR ... opcode table.k" -> "Never pass i(kVar) as a table index for a k-var written inside the same instrument: it reads 0 at init. Use tablekt or pass the value as an i-rate p-field."
- error "perf-time code in global space, ignored" -> "Never put chnget at orchestra/global scope. Read channels inside an instrument body (or an always-on reader instrument), because perf-time code in global space is silently ignored."

Keep it under 220 characters, imperative, no preamble.
If no useful general rule can be drawn, reply with exactly: NONE`

export namespace ErrorLessons {
  export async function distill(e: {
    id: string
    kind: 'compile' | 'runtime'
    errorRaw: string
    brokenCsd?: string | null
    fixedCsd: string
  }): Promise<void> {
    try {
      if (!e.id || !e.errorRaw || !e.fixedCsd) return
      if (!Provider.isConfigured()) return

      const { providerID, modelID } = Provider.smallModel()
      const model = Provider.getLanguageModel(providerID, modelID)
      const user =
        `${e.kind} error:\n${e.errorRaw.slice(0, 600)}\n\n` +
        (e.brokenCsd ? `BROKEN (excerpt):\n${e.brokenCsd.slice(0, 1500)}\n\n` : '') +
        `FIXED (excerpt):\n${e.fixedCsd.slice(0, 1500)}`

      const { text } = await generateText({
        model: model as any,
        system: DISTILL_SYSTEM,
        messages: [{ role: 'user', content: user }],
        temperature: 0,
        maxTokens: 120,
      })

      const rule = text.trim().replace(/^["'`]|["'`]$/g, '').trim()
      if (!rule || /^none\b/i.test(rule) || rule.length > 320) return

      MemoryStore.setErrorFixSummary(e.id, rule)
      Bus.emit('memory:error-lessons-updated')
      Log.info(`memory: distilled error lesson — "${rule.slice(0, 80)}"`)
    } catch (err: any) {
      Log.warn(`error lesson distill failed: ${err?.message}`)
    }
  }
}
