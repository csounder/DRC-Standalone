// Best-effort discovery of an installed Cabbage app/binary so "Open in Cabbage"
// works with zero configuration for most users. We deliberately avoid depending
// on Cabbage's bundle identifier (which has varied across releases) and instead
// match on the well-known install locations + app/binary name, which is stable.
//
// Detection is cached after the first run — it shells out (mdfind/which) and the
// result rarely changes within a session. Pass force=true to re-scan after the
// user installs Cabbage without restarting.
import { execFile } from 'child_process'
import { existsSync, readdirSync } from 'fs'
import { join, basename } from 'path'
import { homedir } from 'os'

let cached: string | null | undefined // undefined = not yet detected

function exec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 4000 }, (err, stdout) => {
      resolve(err ? '' : stdout.toString())
    })
  })
}

// Names in `dir` whose (case-insensitive) name starts with `prefix` and ends
// with `suffix`, returned as absolute paths. Missing dir → [].
function globNames(dir: string, prefix: string, suffix: string): string[] {
  try {
    return readdirSync(dir)
      .filter((n) => {
        const lower = n.toLowerCase()
        return lower.startsWith(prefix) && lower.endsWith(suffix)
      })
      .map((n) => join(dir, n))
  } catch {
    return []
  }
}

async function detectMac(): Promise<string | null> {
  // Standard app folders first — cheap and covers the vast majority.
  for (const dir of ['/Applications', join(homedir(), 'Applications')]) {
    const apps = globNames(dir, 'cabbage', '.app')
    if (apps.length) return apps.sort()[0]
  }
  // Spotlight by name catches non-standard install locations.
  const out = await exec('mdfind', ['-name', 'Cabbage'])
  return (
    out
      .split('\n')
      .map((s) => s.trim())
      .filter((p) => p.toLowerCase().endsWith('.app'))
      .filter((p) => basename(p).toLowerCase().startsWith('cabbage'))
      .find((p) => existsSync(p)) ?? null
  )
}

async function detectWin(): Promise<string | null> {
  const roots = [
    process.env['ProgramFiles'],
    process.env['ProgramFiles(x86)'],
    process.env['LOCALAPPDATA'],
  ].filter(Boolean) as string[]
  for (const root of roots) {
    try {
      for (const name of readdirSync(root)) {
        if (!name.toLowerCase().startsWith('cabbage')) continue
        const exes = globNames(join(root, name), 'cabbage', '.exe')
        if (exes.length) return exes[0]
      }
    } catch {
      // unreadable root — skip
    }
  }
  return null
}

async function detectLinux(): Promise<string | null> {
  for (const name of ['Cabbage', 'cabbage']) {
    const found = (await exec('which', [name])).trim()
    if (found && existsSync(found)) return found
  }
  for (const p of ['/usr/bin/Cabbage', '/usr/local/bin/Cabbage', '/opt/Cabbage/Cabbage']) {
    if (existsSync(p)) return p
  }
  return null
}

export async function detectCabbagePath(force = false): Promise<string | null> {
  if (!force && cached !== undefined) return cached
  let result: string | null = null
  try {
    if (process.platform === 'darwin') result = await detectMac()
    else if (process.platform === 'win32') result = await detectWin()
    else result = await detectLinux()
  } catch {
    result = null
  }
  cached = result
  return result
}
