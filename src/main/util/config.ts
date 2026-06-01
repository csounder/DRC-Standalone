// Shared accessor for the on-disk DRC config (API keys, tool paths, …).
// Both config.ipc.ts and export.ipc.ts read/write this file, so the path and
// (de)serialization live here once rather than being duplicated per handler.
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export type DrcConfig = Record<string, string>

function configPath(): string {
  const dir = join(app.getPath('userData'), 'drc')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'config.json')
}

export function loadConfig(): DrcConfig {
  const path = configPath()
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, 'utf-8'))
    } catch {
      // Corrupt/partial file — treat as empty rather than crash startup.
    }
  }
  return {}
}

// Writes the given config verbatim. Callers build the new object immutably and
// hand it in; we never mutate what we're given.
export function saveConfig(config: DrcConfig): DrcConfig {
  writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf-8')
  return config
}

export function getConfigValue(key: string): string | undefined {
  return loadConfig()[key]
}

// Returns a NEW config with `key` set (or removed when value is empty), persists
// it, and hands the new object back.
export function setConfigValue(key: string, value: string): DrcConfig {
  const current = loadConfig()
  const next = { ...current }
  if (value) next[key] = value
  else delete next[key]
  return saveConfig(next)
}
