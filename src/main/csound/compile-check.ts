import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { withCsoundPath } from '../util/csound-path'

/** Player CSDs use `f 0 36000` to keep realtime MIDI alive — never dry-run that in compile. */
export function shortenHoldScoreForCompile(csd: string): string {
  return csd.replace(/<CsScore>([\s\S]*?)<\/CsScore>/i, (_, score: string) => {
    let s = score
    // Realtime hold score from PLAYER_TEMPLATE
    s = s.replace(/\bf\s+0\s+(\d{3,})\b/gi, 'f 0 1')
    s = s.replace(/\bi\s+(\d+)\s+0\s+(\d{3,})\b/gi, 'i $1 0 1')
    return `<CsScore>${s}</CsScore>`
  })
}

export function needsHoldScoreShortening(csd: string): boolean {
  return /\bf\s+0\s+\d{3,}\b/i.test(csd) || /\bi\s+\d+\s+0\s+\d{3,}\b/i.test(csd)
}

export function compileCheckPath(csdPath: string, tempDir: string): string {
  const raw = readFileSync(csdPath, 'utf-8')
  const checkPath = join(tempDir, 'compile-check.csd')
  writeFileSync(checkPath, shortenHoldScoreForCompile(raw), 'utf-8')
  return checkPath
}

export function runCsoundCompileCheck(
  csdPath: string,
  timeoutMs = 15_000,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn('csound', ['-n', '-d', '-m0', csdPath], {
      env: withCsoundPath(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => { stdout += d.toString() })
    child.stderr?.on('data', (d) => { stderr += d.toString() })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(Object.assign(new Error(`Compile check timed out after ${timeoutMs / 1000}s`), {
        code: 'ETIMEDOUT',
        stdout,
        stderr,
      }))
    }, timeoutMs)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, code })
    })
  })
}
