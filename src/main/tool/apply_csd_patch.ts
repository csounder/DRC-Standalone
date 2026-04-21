import { z } from 'zod'
import { Tool } from './tool'
import { readText, writeText, fileExists } from '../util/fs'

interface Hunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: string[]
}

function parseUnifiedDiff(patch: string): Hunk[] {
  const hunks: Hunk[] = []
  const lines = patch.split('\n')
  let current: Hunk | null = null

  for (const line of lines) {
    const headerMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
    if (headerMatch) {
      if (current) hunks.push(current)
      current = {
        oldStart: parseInt(headerMatch[1]),
        oldCount: parseInt(headerMatch[2] || '1'),
        newStart: parseInt(headerMatch[3]),
        newCount: parseInt(headerMatch[4] || '1'),
        lines: [],
      }
      continue
    }
    if (current && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
      current.lines.push(line)
    }
  }
  if (current) hunks.push(current)
  return hunks
}

function applyHunks(original: string, hunks: Hunk[]): string {
  const lines = original.split('\n')

  // Apply hunks in reverse order to preserve line numbers
  const sorted = [...hunks].sort((a, b) => b.oldStart - a.oldStart)

  for (const hunk of sorted) {
    const start = hunk.oldStart - 1
    const newLines: string[] = []

    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        newLines.push(line.slice(1))
      } else if (line.startsWith(' ')) {
        newLines.push(line.slice(1))
      }
      // Lines starting with '-' are removed (not added to newLines)
    }

    lines.splice(start, hunk.oldCount, ...newLines)
  }

  return lines.join('\n')
}

export const applyCsdPatch = Tool.define('apply_csd_patch', {
  description: 'Apply a unified diff patch to a CSD file. Use this for precise, targeted edits to existing CSD code.',
  parameters: z.object({
    filePath: z.string().describe('Path to the .csd file to patch'),
    patch: z.string().describe('Unified diff format patch to apply'),
  }),
  async execute({ filePath, patch }, ctx) {
    if (!await fileExists(filePath)) {
      return { title: 'Patch failed', metadata: {}, output: `File not found: ${filePath}` }
    }

    try {
      const original = await readText(filePath)

      // Validate CSD structure
      if (!original.includes('<CsoundSynthesizer>') || !original.includes('<CsInstruments>')) {
        return {
          title: 'Patch failed',
          metadata: {},
          output: '✗ File does not appear to be a valid CSD (missing <CsoundSynthesizer> or <CsInstruments>)',
        }
      }

      const hunks = parseUnifiedDiff(patch)
      if (hunks.length === 0) {
        return { title: 'Patch failed', metadata: {}, output: '✗ No valid hunks found in patch' }
      }

      const patched = applyHunks(original, hunks)

      // Validate patched CSD still has structure
      if (!patched.includes('<CsoundSynthesizer>') || !patched.includes('<CsInstruments>')) {
        return {
          title: 'Patch failed',
          metadata: {},
          output: '✗ Patch would break CSD structure (missing required tags after patch)',
        }
      }

      await writeText(filePath, patched)

      return {
        title: 'Patch applied',
        metadata: { filePath, hunks: hunks.length },
        output: `✓ Applied ${hunks.length} hunk(s) to ${filePath}`,
      }
    } catch (err: any) {
      return {
        title: 'Patch failed',
        metadata: {},
        output: `✗ Failed to apply patch: ${err.message}`,
      }
    }
  },
})
