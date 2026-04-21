// SATIE-inspired background particle system
// Light mode: upward-drifting sage spores
// Dark mode: falling luminous stars

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  opacity: number
  phase: number
}

export function initParticles(
  canvas: HTMLCanvasElement,
  theme: 'light' | 'dark'
): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}

  const dpr = window.devicePixelRatio || 1
  let animId: number
  let particles: Particle[] = []
  const count = 18

  function resize() {
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = canvas.offsetHeight * dpr
    ctx!.scale(dpr, dpr)
  }

  function createParticle(): Particle {
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    return {
      x: Math.random() * w,
      y: theme === 'dark' ? -10 : h + 10,
      vx: (Math.random() - 0.5) * 0.3,
      vy: theme === 'dark' ? Math.random() * 0.5 + 0.1 : -(Math.random() * 0.5 + 0.1),
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.4 + 0.1,
      phase: Math.random() * Math.PI * 2,
    }
  }

  function init() {
    resize()
    particles = Array.from({ length: count }, createParticle)
    particles.forEach((p) => {
      p.y = Math.random() * canvas.offsetHeight
    })
  }

  let lastTime = 0
  function animate(time: number) {
    if (time - lastTime < 200) {
      animId = requestAnimationFrame(animate)
      return
    }
    lastTime = time

    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    ctx!.clearRect(0, 0, w, h)

    for (const p of particles) {
      p.x += p.vx + Math.sin(p.phase + time * 0.001) * 0.2
      p.y += p.vy
      p.phase += 0.01

      if (theme === 'dark' && p.y > h + 10) Object.assign(p, createParticle())
      if (theme === 'light' && p.y < -10) Object.assign(p, createParticle())

      ctx!.beginPath()
      ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx!.fillStyle =
        theme === 'dark'
          ? `rgba(200, 210, 220, ${p.opacity})`
          : `rgba(124, 148, 130, ${p.opacity})`
      ctx!.fill()
    }

    animId = requestAnimationFrame(animate)
  }

  init()
  animId = requestAnimationFrame(animate)
  window.addEventListener('resize', resize)

  return () => {
    cancelAnimationFrame(animId)
    window.removeEventListener('resize', resize)
  }
}
