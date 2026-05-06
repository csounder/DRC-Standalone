import { z } from 'zod'
import { Tool } from './tool'
import { spawn } from 'child_process'
import { fileExists } from '../util/fs'
import { withCsoundPath } from '../util/csound-path'

export const csoundSmoke = Tool.define('csound_smoke', {
  description: 'Quick smoke test — runs a CSD briefly to verify it starts without crashing. Faster than full render.',
  parameters: z.object({
    filePath: z.string().describe('Path to the .csd file to test'),
    timeout: z.number().optional().describe('Timeout in seconds (default 1)'),
  }),
  async execute({ filePath, timeout = 1 }, ctx) {
    if (!await fileExists(filePath)) {
      return { title: 'Smoke test failed', metadata: {}, output: `File not found: ${filePath}` }
    }

    return new Promise((resolve) => {
      const proc = spawn('csound', ['-d', '-m0', '-W', '-o', '/dev/null', filePath], {
        timeout: (timeout + 4) * 1000,
        env: withCsoundPath(),
      })

      let stderr = ''
      proc.stderr.on('data', (d) => { stderr += d.toString() })

      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        proc.kill('SIGTERM')
      }, timeout * 1000)

      proc.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0 || timedOut) {
          resolve({
            title: 'Smoke test passed',
            metadata: { success: true },
            output: timedOut
              ? `✓ CSD ran for ${timeout}s without crashing (timed out as expected).`
              : '✓ CSD completed successfully.',
          })
        } else {
          resolve({
            title: 'Smoke test failed',
            metadata: { success: false },
            output: `✗ CSD crashed (exit code ${code}):\n${stderr.trim().slice(0, 500)}`,
          })
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        resolve({
          title: 'Smoke test error',
          metadata: { success: false },
          output: `Failed to run csound: ${err.message}`,
        })
      })
    })
  },
})
