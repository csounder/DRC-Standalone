import { z } from 'zod'
import { Tool } from './tool'
import { writeText, fileExists, readText, ensureDir } from '../util/fs'
import { dirname } from 'path'

export const writeFile = Tool.define('write_file', {
  description: 'Write content to a file. Creates directories if needed. For CSD files, automatically routes to session workspace.',
  parameters: z.object({
    filePath: z.string().describe('Path to write the file'),
    content: z.string().describe('File content to write'),
  }),
  async execute({ filePath, content }, ctx) {
    try {
      await ensureDir(dirname(filePath))

      const existed = await fileExists(filePath)
      let oldContent = ''
      if (existed) {
        oldContent = await readText(filePath)
      }

      await writeText(filePath, content)

      const lines = content.split('\n').length
      return {
        title: existed ? 'File updated' : 'File created',
        metadata: { filePath, lines, created: !existed },
        output: `✓ ${existed ? 'Updated' : 'Created'} ${filePath} (${lines} lines)`,
      }
    } catch (err: any) {
      return {
        title: 'Write failed',
        metadata: {},
        output: `✗ Failed to write ${filePath}: ${err.message}`,
      }
    }
  },
})
