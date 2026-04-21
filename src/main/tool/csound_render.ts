import { z } from 'zod'
import { Tool } from './tool'
import { spawn } from 'child_process'
import { fileExists } from '../util/fs'
import { join, dirname, basename } from 'path'
import { readFile, stat } from 'fs/promises'

function parseWavHeader(buffer: Buffer) {
  if (buffer.length < 44) return null
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
  return {
    sampleRate: view.getUint32(24, true),
    channels: view.getUint16(22, true),
    bitDepth: view.getUint16(34, true),
    dataSize: view.getUint32(40, true),
    get duration() {
      return this.dataSize / (this.sampleRate * this.channels * (this.bitDepth / 8))
    },
  }
}

export const csoundRender = Tool.define('csound_render', {
  description: 'Render a CSD file to a WAV audio file. Returns the output path and audio metadata (duration, sample rate, etc.).',
  parameters: z.object({
    filePath: z.string().describe('Path to the .csd file to render'),
    outputPath: z.string().optional().describe('Output WAV path (defaults to same directory as input)'),
    play: z.boolean().optional().describe('Play the rendered file after completion'),
  }),
  async execute({ filePath, outputPath, play }, ctx) {
    if (!await fileExists(filePath)) {
      return { title: 'Render failed', metadata: {}, output: `File not found: ${filePath}` }
    }

    const outPath = outputPath || join(dirname(filePath), basename(filePath, '.csd') + '.wav')

    return new Promise((resolve) => {
      const proc = spawn('csound', ['-W', '-d', '-m0', '-o', outPath, filePath], {
        timeout: 30000,
      })

      let stderr = ''
      proc.stderr.on('data', (d) => { stderr += d.toString() })

      proc.on('close', async (code) => {
        if (code !== 0 && !await fileExists(outPath)) {
          resolve({
            title: 'Render failed',
            metadata: { success: false },
            output: `✗ Render failed (exit code ${code}):\n${stderr.trim()}`,
          })
          return
        }

        // Parse WAV header for metadata
        let wavInfo = ''
        try {
          const buf = await readFile(outPath)
          const header = parseWavHeader(buf)
          if (header) {
            wavInfo = `\n  Duration: ${header.duration.toFixed(2)}s\n  Sample rate: ${header.sampleRate}Hz\n  Channels: ${header.channels}\n  Bit depth: ${header.bitDepth}`
          }
          const s = await stat(outPath)
          wavInfo += `\n  File size: ${(s.size / 1024).toFixed(1)}KB`
        } catch {}

        // Optional playback
        if (play) {
          const player = process.platform === 'darwin' ? 'afplay' : 'paplay'
          const playProc = spawn(player, [outPath], { detached: true, stdio: 'ignore' })
          playProc.unref()
        }

        resolve({
          title: 'Render complete',
          metadata: { success: true, outputPath: outPath },
          output: `✓ Rendered to ${outPath}${wavInfo}`,
        })
      })

      proc.on('error', (err) => {
        resolve({
          title: 'Render error',
          metadata: { success: false },
          output: `Failed to run csound: ${err.message}`,
        })
      })
    })
  },
})
