import { useRef, useEffect, type CSSProperties } from 'react'

interface Props {
  audioBuffer?: AudioBuffer | null
  currentTime?: number
  duration?: number
  height?: number
}

export default function WaveformDisplay({ audioBuffer, currentTime = 0, duration = 0, height = 120 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = canvas.offsetWidth
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = 'var(--bg-secondary)'
    ctx.fillRect(0, 0, width, height)

    if (!audioBuffer) {
      // Draw idle waveform visualization
      drawIdleWave(ctx, width, height)
      return
    }

    // Draw actual waveform
    const data = audioBuffer.getChannelData(0)
    const step = Math.ceil(data.length / width)
    const halfH = height / 2

    ctx.beginPath()
    ctx.strokeStyle = '#7cb8a4'
    ctx.lineWidth = 1

    for (let i = 0; i < width; i++) {
      let min = 1.0
      let max = -1.0
      for (let j = 0; j < step; j++) {
        const val = data[i * step + j] || 0
        if (val < min) min = val
        if (val > max) max = val
      }
      ctx.moveTo(i, halfH + min * halfH)
      ctx.lineTo(i, halfH + max * halfH)
    }
    ctx.stroke()

    // Playhead
    if (duration > 0 && currentTime > 0) {
      const x = (currentTime / duration) * width
      ctx.beginPath()
      ctx.strokeStyle = '#58a6ff'
      ctx.lineWidth = 1.5
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
  }, [audioBuffer, currentTime, duration, height])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height,
        borderRadius: 12,
        display: 'block',
      }}
    />
  )
}

function drawIdleWave(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const halfH = height / 2
  const time = Date.now() / 1000

  ctx.beginPath()
  ctx.strokeStyle = 'rgba(124, 184, 164, 0.15)'
  ctx.lineWidth = 1

  for (let i = 0; i < width; i++) {
    const x = i / width
    const y = Math.sin(x * Math.PI * 4 + time * 0.5) * 0.15 +
              Math.sin(x * Math.PI * 7 + time * 0.3) * 0.08 +
              Math.sin(x * Math.PI * 13 + time * 0.7) * 0.04
    ctx.lineTo(i, halfH + y * halfH)
  }
  ctx.stroke()

  // Mirror
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(124, 184, 164, 0.08)'
  for (let i = 0; i < width; i++) {
    const x = i / width
    const y = Math.sin(x * Math.PI * 4 + time * 0.5) * 0.15 +
              Math.sin(x * Math.PI * 7 + time * 0.3) * 0.08 +
              Math.sin(x * Math.PI * 13 + time * 0.7) * 0.04
    ctx.lineTo(i, halfH - y * halfH)
  }
  ctx.stroke()
}
