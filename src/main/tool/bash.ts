import { z } from 'zod'
import { Tool } from './tool'
import { spawn } from 'child_process'

export const bash = Tool.define('bash', {
  description: 'Execute a shell command. Use for Csound CLI operations, file management, and system tasks.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z.number().optional().describe('Timeout in seconds (default 30)'),
  }),
  async execute({ command, timeout = 30 }, ctx) {
    return new Promise((resolve) => {
      const proc = spawn('bash', ['-c', command], {
        timeout: timeout * 1000,
        cwd: process.cwd(),
      })

      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (d) => { stdout += d.toString() })
      proc.stderr.on('data', (d) => { stderr += d.toString() })

      proc.on('close', (code) => {
        const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '')
        resolve({
          title: code === 0 ? 'Command succeeded' : `Command failed (${code})`,
          metadata: { exitCode: code },
          output: output.trim() || `(no output, exit code ${code})`,
        })
      })

      proc.on('error', (err) => {
        resolve({
          title: 'Command error',
          metadata: { exitCode: -1 },
          output: `Failed to execute: ${err.message}`,
        })
      })
    })
  },
})
