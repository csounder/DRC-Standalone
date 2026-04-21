import { z } from 'zod'
import { Tool } from './tool'
import { readText, fileExists } from '../util/fs'

export const readFile = Tool.define('read_file', {
  description: 'Read the contents of a file. Returns the file content as text.',
  parameters: z.object({
    filePath: z.string().describe('Path to the file to read'),
    startLine: z.number().optional().describe('Starting line number (1-based)'),
    endLine: z.number().optional().describe('Ending line number (inclusive)'),
  }),
  async execute({ filePath, startLine, endLine }, ctx) {
    if (!await fileExists(filePath)) {
      return { title: 'Read failed', metadata: {}, output: `File not found: ${filePath}` }
    }

    try {
      let content = await readText(filePath)
      const totalLines = content.split('\n').length

      if (startLine || endLine) {
        const lines = content.split('\n')
        const start = (startLine || 1) - 1
        const end = endLine || lines.length
        content = lines.slice(start, end).join('\n')
      }

      return {
        title: `Read ${filePath}`,
        metadata: { filePath, totalLines },
        output: content,
      }
    } catch (err: any) {
      return {
        title: 'Read failed',
        metadata: {},
        output: `✗ Failed to read ${filePath}: ${err.message}`,
      }
    }
  },
})
