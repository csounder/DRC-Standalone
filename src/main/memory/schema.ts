// Hand-written schema for the on-disk memory DB.
//
// We drive better-sqlite3 directly with prepared statements rather than a
// migration tool: the schema is small, the native module is the only moving
// part, and idempotent `CREATE TABLE IF NOT EXISTS` keeps upgrades trivial.
// (drizzle-orm is installed but its query builder buys us little here and adds
// a version-coupling risk on top of the native addon.)
//
// Column names are snake_case in SQLite; the store layer maps them to the
// camelCase row types below at the boundary so the rest of main/ stays tidy.

export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  agent_name  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  title       TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  timestamp   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY,
  session_id  TEXT,
  message_id  TEXT,
  kind        TEXT NOT NULL,
  rating      INTEGER,
  signals     TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_session ON feedback(session_id);

-- Durable instructions the user stated in chat that should apply to FUTURE
-- requests across all sessions (e.g. "when I ask for a granular cloud texture,
-- make it tonal"). Extracted from user turns and injected into every prompt.
CREATE TABLE IF NOT EXISTS lessons (
  id          TEXT PRIMARY KEY,
  text        TEXT NOT NULL,
  norm        TEXT NOT NULL,
  session_id  TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS error_fixes (
  id           TEXT PRIMARY KEY,
  session_id   TEXT,
  kind         TEXT NOT NULL,
  signature    TEXT NOT NULL,
  error_raw    TEXT NOT NULL,
  broken_csd   TEXT,
  fixed_csd    TEXT NOT NULL,
  diff_summary TEXT,
  tokens       TEXT,
  uses         INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_errfix_sig ON error_fixes(signature);

-- Single-row store of what the agent has learned from this user's feedback.
-- This is NOT a model of the user — it's signed preference weights that steer
-- generation quality: techniques/opcodes the user liked (positive) vs reacted
-- poorly to (negative). Injected into the prompt as soft guidance.
CREATE TABLE IF NOT EXISTS learning (
  id             TEXT PRIMARY KEY,
  techniques     TEXT NOT NULL DEFAULT '{}',
  opcodes        TEXT NOT NULL DEFAULT '{}',
  total_feedback INTEGER NOT NULL DEFAULT 0,
  updated_at     INTEGER NOT NULL
);
`

export const SINGLETON_ID = 'default'

export type FeedbackKind =
  | 'thumbs_up'
  | 'thumbs_down'
  | 'accepted_fix'
  | 'user_edit'
  | 'rating'

export type ErrorFixKind = 'compile' | 'runtime'

export interface SessionRow {
  id: string
  agentName: string
  createdAt: number
  updatedAt: number
  title: string | null
}

export interface MessageRow {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface FeedbackRow {
  id: string
  sessionId: string | null
  messageId: string | null
  kind: FeedbackKind
  rating: number | null
  signals: Record<string, unknown> | null
  createdAt: number
}

export interface ErrorFixRow {
  id: string
  sessionId: string | null
  kind: ErrorFixKind
  signature: string
  errorRaw: string
  brokenCsd: string | null
  fixedCsd: string
  diffSummary: string | null
  tokens: string[]
  uses: number
  createdAt: number
}

export interface LessonRow {
  id: string
  text: string
  sessionId: string | null
  createdAt: number
}

export interface LearningRow {
  techniques: Record<string, number> // signed: +liked / -disliked
  opcodes: Record<string, number>
  totalFeedback: number
  updatedAt: number
}
