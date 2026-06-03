import { ascending } from '../util/id'
import { Log } from '../util/log'
import { MemoryDB } from './db'
import type {
  SessionRow,
  MessageRow,
  FeedbackRow,
  ErrorFixRow,
  LessonRow,
  FeedbackKind,
  ErrorFixKind,
} from './schema'

// All reads/writes for the memory DB. Every write early-returns when the DB is
// disabled (native module failed to load) so callers never need to guard.

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3)
}

// Collapse a raw Csound error into a stable fingerprint: drop line numbers,
// quoted identifiers and bare numbers so "opcode 'fooosc' (line 14)" and
// "opcode 'baar' (line 92)" share a signature and can match each other.
function normalizeError(errorRaw: string): string {
  return errorRaw
    .toLowerCase()
    .replace(/line\s+\d+/g, 'line n')
    .replace(/['"`][^'"`]*['"`]/g, ' ')
    .replace(/\b\d+(\.\d+)?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export namespace MemoryStore {
  export function signatureOf(errorRaw: string): { signature: string; tokens: string[] } {
    const signature = normalizeError(errorRaw)
    return { signature, tokens: Array.from(new Set(tokenize(signature))) }
  }

  // --- sessions & messages ---------------------------------------------------

  export function upsertSession(s: {
    id: string
    agentName: string
    createdAt: number
    title?: string | null
  }): void {
    if (!MemoryDB.isReady()) return
    try {
      MemoryDB.raw()
        .prepare(
          `INSERT INTO sessions (id, agent_name, created_at, updated_at, title)
           VALUES (@id, @agentName, @createdAt, @updatedAt, @title)
           ON CONFLICT(id) DO UPDATE SET agent_name = @agentName, updated_at = @updatedAt`,
        )
        .run({
          id: s.id,
          agentName: s.agentName,
          createdAt: s.createdAt,
          updatedAt: Date.now(),
          title: s.title ?? null,
        })
    } catch (err: any) {
      Log.warn(`memory upsertSession failed: ${err?.message}`)
    }
  }

  export function touchSession(id: string, title?: string): void {
    if (!MemoryDB.isReady()) return
    try {
      if (title) {
        MemoryDB.raw()
          .prepare(
            `UPDATE sessions SET updated_at = ?, title = COALESCE(title, ?) WHERE id = ?`,
          )
          .run(Date.now(), title, id)
      } else {
        MemoryDB.raw().prepare(`UPDATE sessions SET updated_at = ? WHERE id = ?`).run(Date.now(), id)
      }
    } catch (err: any) {
      Log.warn(`memory touchSession failed: ${err?.message}`)
    }
  }

  export function appendMessage(m: {
    id: string
    sessionId: string
    role: string
    content: string
    timestamp: number
  }): void {
    if (!MemoryDB.isReady()) return
    try {
      MemoryDB.raw()
        .prepare(
          `INSERT OR IGNORE INTO messages (id, session_id, role, content, timestamp)
           VALUES (@id, @sessionId, @role, @content, @timestamp)`,
        )
        .run(m)
    } catch (err: any) {
      Log.warn(`memory appendMessage failed: ${err?.message}`)
    }
  }

  export function loadSession(id: string): { session: SessionRow; messages: MessageRow[] } | undefined {
    if (!MemoryDB.isReady()) return undefined
    try {
      const row = MemoryDB.raw().prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as any
      if (!row) return undefined
      const msgs = MemoryDB.raw()
        .prepare(`SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC`)
        .all(id) as any[]
      return {
        session: {
          id: row.id,
          agentName: row.agent_name,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          title: row.title,
        },
        messages: msgs.map((r) => ({
          id: r.id,
          sessionId: r.session_id,
          role: r.role,
          content: r.content,
          timestamp: r.timestamp,
        })),
      }
    } catch (err: any) {
      Log.warn(`memory loadSession failed: ${err?.message}`)
      return undefined
    }
  }

  export function listSessions(limit = 50): SessionRow[] {
    if (!MemoryDB.isReady()) return []
    try {
      const rows = MemoryDB.raw()
        .prepare(`SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?`)
        .all(limit) as any[]
      return rows.map((r) => ({
        id: r.id,
        agentName: r.agent_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        title: r.title,
      }))
    } catch (err: any) {
      Log.warn(`memory listSessions failed: ${err?.message}`)
      return []
    }
  }

  export function messageCount(sessionId: string): number {
    if (!MemoryDB.isReady()) return 0
    try {
      const row = MemoryDB.raw()
        .prepare(`SELECT COUNT(*) AS n FROM messages WHERE session_id = ?`)
        .get(sessionId) as any
      return row?.n ?? 0
    } catch {
      return 0
    }
  }

  // --- feedback --------------------------------------------------------------

  export function saveFeedback(f: {
    sessionId?: string | null
    messageId?: string | null
    kind: FeedbackKind
    rating?: number | null
    signals?: Record<string, unknown> | null
  }): string {
    const id = ascending('feedback')
    if (!MemoryDB.isReady()) return id
    try {
      MemoryDB.raw()
        .prepare(
          `INSERT INTO feedback (id, session_id, message_id, kind, rating, signals, created_at)
           VALUES (@id, @sessionId, @messageId, @kind, @rating, @signals, @createdAt)`,
        )
        .run({
          id,
          sessionId: f.sessionId ?? null,
          messageId: f.messageId ?? null,
          kind: f.kind,
          rating: f.rating ?? null,
          signals: f.signals ? JSON.stringify(f.signals) : null,
          createdAt: Date.now(),
        })
    } catch (err: any) {
      Log.warn(`memory saveFeedback failed: ${err?.message}`)
    }
    return id
  }

  export function recentFeedback(limit = 30): FeedbackRow[] {
    if (!MemoryDB.isReady()) return []
    try {
      const rows = MemoryDB.raw()
        .prepare(`SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?`)
        .all(limit) as any[]
      return rows.map(mapFeedback)
    } catch {
      return []
    }
  }

  // --- error -> fix library --------------------------------------------------

  export function saveErrorFix(e: {
    sessionId?: string | null
    kind: ErrorFixKind
    errorRaw: string
    brokenCsd?: string | null
    fixedCsd: string
    diffSummary?: string | null
  }): string {
    const id = ascending('errfix')
    if (!MemoryDB.isReady()) return id
    try {
      const { signature, tokens } = signatureOf(e.errorRaw)
      MemoryDB.raw()
        .prepare(
          `INSERT INTO error_fixes
             (id, session_id, kind, signature, error_raw, broken_csd, fixed_csd, diff_summary, tokens, uses, created_at)
           VALUES (@id, @sessionId, @kind, @signature, @errorRaw, @brokenCsd, @fixedCsd, @diffSummary, @tokens, 0, @createdAt)`,
        )
        .run({
          id,
          sessionId: e.sessionId ?? null,
          kind: e.kind,
          signature,
          errorRaw: e.errorRaw.slice(0, 1000),
          brokenCsd: e.brokenCsd ? e.brokenCsd.slice(0, 4000) : null,
          fixedCsd: e.fixedCsd.slice(0, 4000),
          diffSummary: e.diffSummary ?? null,
          tokens: JSON.stringify(tokens),
          createdAt: Date.now(),
        })
      Log.info(`memory: stored ${e.kind} error→fix pair (${signature.slice(0, 60)}…)`)
    } catch (err: any) {
      Log.warn(`memory saveErrorFix failed: ${err?.message}`)
    }
    return id
  }

  export function bumpErrorFixUse(id: string): void {
    if (!MemoryDB.isReady()) return
    try {
      MemoryDB.raw().prepare(`UPDATE error_fixes SET uses = uses + 1 WHERE id = ?`).run(id)
    } catch {
      /* telemetry only */
    }
  }

  // Attach a distilled one-line "avoidance rule" to a stored error→fix pair.
  // Populated best-effort by ErrorLessons.distill after a successful autofix; it
  // is what the proactive <previous-errors> prompt block surfaces.
  export function setErrorFixSummary(id: string, summary: string): void {
    if (!MemoryDB.isReady()) return
    try {
      MemoryDB.raw()
        .prepare(`UPDATE error_fixes SET diff_summary = ? WHERE id = ?`)
        .run(summary.slice(0, 280), id)
    } catch (err: any) {
      Log.warn(`memory setErrorFixSummary failed: ${err?.message}`)
    }
  }

  // --- remembered instructions (lessons) ------------------------------------

  function normalizeLesson(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  }

  // Returns the new id, or null if a near-identical lesson already exists.
  export function saveLesson(text: string, sessionId?: string | null): string | null {
    const id = ascending('lesson')
    if (!MemoryDB.isReady()) return id
    try {
      const norm = normalizeLesson(text)
      const dupe = MemoryDB.raw()
        .prepare(`SELECT id FROM lessons WHERE active = 1 AND norm = ?`)
        .get(norm)
      if (dupe) return null
      MemoryDB.raw()
        .prepare(
          `INSERT INTO lessons (id, text, norm, session_id, active, created_at)
           VALUES (@id, @text, @norm, @sessionId, 1, @createdAt)`,
        )
        .run({ id, text: text.slice(0, 280), norm, sessionId: sessionId ?? null, createdAt: Date.now() })
      Log.info(`memory: remembered instruction — "${text.slice(0, 80)}"`)
      return id
    } catch (err: any) {
      Log.warn(`memory saveLesson failed: ${err?.message}`)
      return null
    }
  }

  export function allLessons(): LessonRow[] {
    if (!MemoryDB.isReady()) return []
    try {
      const rows = MemoryDB.raw()
        .prepare(`SELECT * FROM lessons WHERE active = 1 ORDER BY created_at DESC LIMIT 100`)
        .all() as any[]
      return rows.map((r) => ({
        id: r.id,
        text: r.text,
        sessionId: r.session_id,
        createdAt: r.created_at,
      }))
    } catch {
      return []
    }
  }

  export function deleteLesson(id: string): void {
    if (!MemoryDB.isReady()) return
    try {
      MemoryDB.raw().prepare(`UPDATE lessons SET active = 0 WHERE id = ?`).run(id)
    } catch (err: any) {
      Log.warn(`memory deleteLesson failed: ${err?.message}`)
    }
  }

  export function allErrorFixes(): ErrorFixRow[] {
    if (!MemoryDB.isReady()) return []
    try {
      const rows = MemoryDB.raw()
        .prepare(`SELECT * FROM error_fixes ORDER BY created_at DESC LIMIT 500`)
        .all() as any[]
      return rows.map(mapErrorFix)
    } catch {
      return []
    }
  }
}

function mapFeedback(r: any): FeedbackRow {
  return {
    id: r.id,
    sessionId: r.session_id,
    messageId: r.message_id,
    kind: r.kind,
    rating: r.rating,
    signals: r.signals ? safeJson(r.signals) : null,
    createdAt: r.created_at,
  }
}

function mapErrorFix(r: any): ErrorFixRow {
  return {
    id: r.id,
    sessionId: r.session_id,
    kind: r.kind,
    signature: r.signature,
    errorRaw: r.error_raw,
    brokenCsd: r.broken_csd,
    fixedCsd: r.fixed_csd,
    diffSummary: r.diff_summary,
    tokens: r.tokens ? (safeJson(r.tokens) as string[]) ?? [] : [],
    uses: r.uses,
    createdAt: r.created_at,
  }
}

function safeJson(s: string): any {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
