// macOS Electron apps don't inherit the user's shell PATH — `launchd` boots
// `Electron.app` with a minimal `/usr/bin:/bin:/usr/sbin:/sbin`, so a Homebrew
// install at `/opt/homebrew/bin/csound` is invisible to spawn/execFile and the
// child fails with ENOENT. Re-augment PATH ourselves at every csound spawn site.
//
// Order matters: prepend (not append) so a Homebrew/MacPorts/CsoundQT-bundled
// binary wins over any stale `csound` shim that might exist elsewhere on PATH.

const EXTRA_PATHS = [
  '/opt/homebrew/bin',                      // Apple Silicon Homebrew
  '/usr/local/bin',                         // Intel Homebrew + MacPorts default
  '/Applications/Csound/CsoundLib64.framework/Versions/Current/Resources/bin',
  '/Library/Frameworks/CsoundLib64.framework/Versions/Current/Resources/bin',
]

export function withCsoundPath(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = { ...process.env, ...(extra ?? {}) }
  const current = env.PATH ?? ''
  const parts = current.split(':').filter(Boolean)
  for (const p of EXTRA_PATHS) {
    if (!parts.includes(p)) parts.unshift(p)
  }
  env.PATH = parts.join(':')
  return env
}
