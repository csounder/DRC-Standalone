const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const
type LogLevel = typeof LOG_LEVELS[number]

let currentLevel: LogLevel = 'info'

export const Log = {
  setLevel(level: LogLevel) { currentLevel = level },

  debug(...args: any[]) {
    if (LOG_LEVELS.indexOf(currentLevel) <= 0) console.debug('[drc]', ...args)
  },
  info(...args: any[]) {
    if (LOG_LEVELS.indexOf(currentLevel) <= 1) console.info('[drc]', ...args)
  },
  warn(...args: any[]) {
    if (LOG_LEVELS.indexOf(currentLevel) <= 2) console.warn('[drc]', ...args)
  },
  error(...args: any[]) {
    console.error('[drc]', ...args)
  },
}
