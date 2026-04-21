// Node.js replacements for Bun file APIs
import { readFile, writeFile, stat, access, mkdir } from 'fs/promises'
import { constants, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export async function readText(path: string): Promise<string> {
  return readFile(path, 'utf-8')
}

export async function readJSON<T = any>(path: string): Promise<T> {
  const text = await readFile(path, 'utf-8')
  return JSON.parse(text)
}

export async function writeText(path: string, content: string): Promise<void> {
  await writeFile(path, content, 'utf-8')
}

export async function writeJSON(path: string, data: any): Promise<void> {
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
}

export async function fileSize(path: string): Promise<number> {
  const s = await stat(path)
  return s.size
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

// User data path: ~/.drc/ equivalent
let _dataPath: string | null = null

export function getDataPath(): string {
  if (_dataPath) return _dataPath
  try {
    _dataPath = join(app.getPath('userData'), 'drc')
  } catch {
    // Fallback for when app is not ready
    _dataPath = join(process.env.HOME || '/tmp', '.drc')
  }
  if (!existsSync(_dataPath)) mkdirSync(_dataPath, { recursive: true })
  return _dataPath
}

export function getSessionsPath(): string {
  const p = join(getDataPath(), 'sessions')
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
  return p
}

export function getMemoryPath(): string {
  const p = join(getDataPath(), 'memory')
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
  return p
}
