import { join } from 'path'

// macOS Electron apps don't inherit the user's shell PATH — `launchd` boots
// `Electron.app` with a minimal `/usr/bin:/bin:/usr/sbin:/sbin`, so a Homebrew
// install at `/opt/homebrew/bin/csound` is invisible to spawn/execFile and the
// child fails with ENOENT. Re-augment PATH ourselves at every csound spawn site.
//
// Order matters: prepend (not append) so a user-local Csound 7 install wins over
// stale system shims (e.g. /usr/local/bin Csound 6.18).

const HOME = process.env.HOME ?? ''

const EXTRA_PATHS = [
  join(HOME, 'bin'),
  join(HOME, 'Applications/Csound'),
  join(HOME, '.local/bin'),
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/Applications/Csound/CsoundLib64.framework/Versions/Current/Resources/bin',
  '/Library/Frameworks/CsoundLib64.framework/Versions/Current/Resources/bin',
]

export function withCsoundPath(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env, ...(extra ?? {}) }
  const current = env.PATH ?? ''
  const parts = current.split(':').filter(Boolean)
  for (const p of EXTRA_PATHS) {
    if (p && !parts.includes(p)) parts.unshift(p)
  }
  env.PATH = parts.join(':')
  return env
}
