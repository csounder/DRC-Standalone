import { z } from 'zod'
import { Tool } from './tool'
import { spawn } from 'child_process'
import { fileExists, readText } from '../util/fs'
import { withCsoundPath } from '../util/csound-path'

interface CompileError {
  line?: number
  type: 'syntax' | 'unknown_opcode' | 'type_mismatch' | 'missing_instrument' | 'other'
  message: string
}

function parseCsoundErrors(stderr: string): CompileError[] {
  const errors: CompileError[] = []
  const lines = stderr.split('\n')
  for (const line of lines) {
    const lineMatch = line.match(/error:?\s*(.*)/i)
    if (lineMatch) {
      let type: CompileError['type'] = 'other'
      if (/unknown opcode/i.test(line)) type = 'unknown_opcode'
      else if (/syntax/i.test(line)) type = 'syntax'
      else if (/type/i.test(line)) type = 'type_mismatch'
      else if (/instr/i.test(line)) type = 'missing_instrument'

      const lineNum = line.match(/line\s+(\d+)/i)
      errors.push({
        line: lineNum ? parseInt(lineNum[1]) : undefined,
        type,
        message: lineMatch[1].trim(),
      })
    }
  }
  return errors
}

export const csoundCompile = Tool.define('csound_compile', {
  description: 'Compile a CSD file to check for syntax errors without rendering audio. Returns compilation status and any errors found.',
  parameters: z.object({
    filePath: z.string().describe('Path to the .csd file to compile'),
  }),
  async execute({ filePath }, ctx) {
    if (!await fileExists(filePath)) {
      return { title: 'Compile failed', metadata: {}, output: `File not found: ${filePath}` }
    }
    if (!filePath.endsWith('.csd')) {
      return { title: 'Compile failed', metadata: {}, output: 'File must have .csd extension' }
    }

    return new Promise((resolve) => {
      const proc = spawn('csound', ['-n', '-d', '-m0', '-W', '-o', 'null', filePath], {
        timeout: 10000,
        env: withCsoundPath(),
      })

      let stderr = ''
      let stdout = ''
      proc.stderr.on('data', (d) => { stderr += d.toString() })
      proc.stdout.on('data', (d) => { stdout += d.toString() })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            title: 'Compilation successful',
            metadata: { success: true },
            output: '✓ CSD compiled successfully — no errors found.',
          })
        } else {
          const errors = parseCsoundErrors(stderr)
          const errorSummary = errors.length > 0
            ? errors.map((e) => `  Line ${e.line || '?'}: [${e.type}] ${e.message}`).join('\n')
            : stderr.trim()
          resolve({
            title: 'Compilation failed',
            metadata: { success: false, errors },
            output: `✗ Compilation failed:\n${errorSummary}`,
          })
        }
      })

      proc.on('error', (err) => {
        resolve({
          title: 'Compile error',
          metadata: { success: false },
          output: `Failed to run csound: ${err.message}. Is Csound installed and on your PATH?`,
        })
      })
    })
  },
})
