import { IpcMain } from 'electron'
import { generateText } from 'ai'
import { Provider } from '../provider/provider'
import { Log } from '../util/log'

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
      const { text } = await generateText({
        model: model as any,
        messages: [{ role: 'user', content: trimmed }],
        temperature: 0.2,
        maxTokens: 4000,
      })
      const csd = extractCsd(text)
      if (!csd) {
        Log.warn('llm:adaptCsd → response did not contain a CsoundSynthesizer block')
        return { ok: false, error: 'Model response missing <CsoundSynthesizer> block', raw: text.slice(0, 400) }
      }
      return { ok: true, csd }
    } catch (err: any) {
      Log.error('llm:adaptCsd error:', err.message)
      return { ok: false, error: err.message }
    }
  })
}
