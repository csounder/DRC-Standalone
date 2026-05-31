import { IpcMain } from 'electron'
import { MemoryStore } from '../memory/store'
import { MemoryRetrieval } from '../memory/retrieve'
import { Learning, type FeedbackEvent } from '../memory/learning'
import { Log } from '../util/log'

export function handleMemoryIPC(ipcMain: IpcMain): void {
  // Generic recall: top error→fix pairs relevant to a free-text query.
  ipcMain.handle('memory:recall', async (_event, query: string) => {
    return { results: MemoryRetrieval.relevantErrorFixes(query, 5) }
  })

  // Typed save entry point (kept for the original contract).
  ipcMain.handle('memory:save', async (_event, type: string, data: any) => {
    switch (type) {
      case 'error_fix':
        return { id: MemoryStore.saveErrorFix(data) }
      case 'feedback':
        return { id: MemoryStore.saveFeedback(data) }
      default:
        return { success: false, error: `unknown memory save type: ${type}` }
    }
  })

  // What the agent has learned from feedback (favored/disfavored techniques).
  ipcMain.handle('memory:profile', async () => Learning.get())

  // Durable instructions the user has given (remembered across sessions).
  ipcMain.handle('memory:lessons', async () => MemoryStore.allLessons())
  ipcMain.handle('memory:deleteLesson', async (_e, id: string) => {
    MemoryStore.deleteLesson(id)
    return { success: true }
  })

  // Unified feedback channel used by the renderer. `accepted_fix` additionally
  // stores the error→fix pair so the agent can reuse it next time.
  ipcMain.handle('memory:feedback', async (_event, kind: string, payload: any = {}) => {
    if (kind === 'accepted_fix' && payload?.fixedCsd) {
      MemoryStore.saveErrorFix({
        sessionId: payload.sessionId ?? null,
        kind: payload.kind === 'runtime' ? 'runtime' : 'compile',
        errorRaw: String(payload.errorRaw ?? ''),
        brokenCsd: payload.brokenCsd ?? null,
        fixedCsd: String(payload.fixedCsd),
        diffSummary: payload.diffSummary ?? null,
      })
    }

    const ev: FeedbackEvent = {
      kind: kind as FeedbackEvent['kind'],
      rating: payload.rating ?? null,
      signals: {
        techniques: payload.techniques,
        opcodes: payload.opcodes,
        content: payload.content ?? payload.fixedCsd,
      },
    }
    const id = MemoryStore.saveFeedback({
      sessionId: payload.sessionId ?? null,
      messageId: payload.messageId ?? null,
      kind: ev.kind,
      rating: ev.rating,
      signals: ev.signals,
    })
    Learning.applyFeedback(ev)
    Log.info(`memory:feedback ${kind}`)
    return { id }
  })
}
