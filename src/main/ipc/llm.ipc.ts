import { IpcMain } from 'electron'
import { generateText } from 'ai'
import { Provider } from '../provider/provider'
import { Log } from '../util/log'
import { usageFromSdk } from '../util/usage-cost'

// Extract the <CsoundSynthesizer>...</CsoundSynthesizer> block from a model
// response. Models occasionally leak code fences or a trailing sentence despite
// the prompt forbidding them, so we pull the block out defensively.
function extractCsd(raw: string): string | null {
  const m = raw.match(/<CsoundSynthesizer[\s\S]*?<\/CsoundSynthesizer>/i)
  return m ? m[0] : null
}

export function handleLlmIPC(ipcMain: IpcMain): void {
  ipcMain.handle('llm:adaptCsd', async (_event, prompt: string) => {
    const trimmed = String(prompt ?? '').trim()
    if (!trimmed) return { ok: false, error: 'Empty prompt' }

    const { providerID, modelID } = Provider.defaultProvider()
    let model
    try {
      model = Provider.getLanguageModel(providerID, modelID)
    } catch (err: any) {
      return { ok: false, error: `Model unavailable: ${err.message}` }
    }

    Log.info(`llm:adaptCsd → ${providerID}/${modelID} (${trimmed.length} chars)`)

    try {
      const result = await generateText({
        model: model as any,
        messages: [{ role: 'user', content: trimmed }],
        temperature: 0.2,
        maxTokens: 8192,
      })
      const csd = extractCsd(result.text)
      if (!csd) {
        Log.warn('llm:adaptCsd → response did not contain a CsoundSynthesizer block')
        return { ok: false, error: 'Model response missing <CsoundSynthesizer> block', raw: result.text.slice(0, 400) }
      }
      const usage = usageFromSdk(providerID, modelID, result.usage, 'player')
      return { ok: true, csd, usage: usage ?? undefined }
    } catch (err: any) {
      Log.error('llm:adaptCsd error:', err.message)
      return { ok: false, error: Provider.humanizeError(providerID, err) }
    }
  })
}
