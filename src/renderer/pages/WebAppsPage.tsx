import { useState, type CSSProperties } from 'react'
import { useEditorStore } from '../stores/editorStore'

interface AppTemplate {
  id: string
  name: string
  desc: string
  icon: string
  tags: string[]
  csd: string // Embedded CSD sample
}

const REFERENCE_APPS: AppTemplate[] = [
  {
    id: 'drum-machine',
    name: 'Drum Machine',
    desc: '16-step sequencer with 10 synth drums, 6 kits, 12 global effects',
    icon: '🥁',
    tags: ['sequencer', 'percussion', 'FM synthesis'],
    csd: `; Drum Machine - FM Kick
instr 1  ; kick
  iAmp = p5
  kFreq expseg 200, 0.02, 55, p3-0.02, 30
  kEnv expseg iAmp, 0.01, iAmp, p3-0.01, 0.001
  aOut oscili kEnv, kFreq
  aOut butterlp aOut, 200
  outs aOut, aOut
endin`,
  },
  {
    id: 'etude1',
    name: 'Étude #1',
    desc: 'Generative audiovisual piece — 14 autonomous instruments in B Phrygian',
    icon: '✦',
    tags: ['generative', 'autonomous', 'FOF synthesis', 'Three.js'],
    csd: `; Étude #1 - Autonomous composer
instr 10  ; grain cloud
  iDur = p3
  iFreq = p4
  kDens linseg 10, iDur*0.3, 80, iDur*0.4, 40, iDur*0.3, 5
  aOut grain iFreq, 0.02, kDens, 1, 1, 0.5
  kEnv linseg 0, 0.1, 0.3, iDur-0.2, 0.3, 0.1, 0
  outs aOut*kEnv, aOut*kEnv
endin`,
  },
  {
    id: 'fibonacci-fm',
    name: 'Fibonacci FM Explorer',
    desc: 'FM synth with 25 scales (microtonal, Fibonacci, Bohlen-Pierce), ghost mode, 30+ presets',
    icon: '🌀',
    tags: ['FM synthesis', 'microtonal', 'polyphonic', 'MIDI'],
    csd: `; Fibonacci FM - Golden ratio FM
instr 1
  iFreq = p4
  iAmp = p5
  iPhi = 1.618033988 ; golden ratio

  iModFreq = iFreq * iPhi
  kModIdx expseg 12, p3*0.5, 3, p3*0.5, 0.5

  aMod oscili iFreq*kModIdx, iModFreq
  aOut oscili iAmp, iFreq + aMod

  kEnv madsr 0.01, 0.3, 0.6, 0.5
  outs aOut*kEnv, aOut*kEnv
endin`,
  },
  {
    id: 'fm-bell',
    name: 'FM Bell',
    desc: 'Minimal FM synthesis example — clean, focused, under 2KB',
    icon: '🔔',
    tags: ['FM synthesis', 'beginner', 'minimal'],
    csd: `; FM Bell
instr 1
  iFreq = p4
  iAmp = p5
  kIdx expseg 8, p3*0.8, 0.1, p3*0.2, 0.01
  aMod oscili iFreq*3.5*kIdx, iFreq*3.5
  kEnv expseg iAmp, 0.01, iAmp, p3-0.01, 0.001
  aOut oscili kEnv, iFreq + aMod
  outs aOut, aOut
endin`,
  },
  {
    id: 'fractal-explorer',
    name: 'Fractal Explorer',
    desc: 'L-System music — Algae, Tree, Dragon, Koch, Sierpinski mapped to synthesis',
    icon: '🌿',
    tags: ['L-system', 'algorithmic', 'fractal', 'ambisonics'],
    csd: `; Fractal Explorer - L-system note generator
; Depth maps to pitch, angle maps to duration
instr 1
  iFreq = p4
  iDur = p3
  iPan = p6

  kEnv adsr 0.05, iDur*0.3, 0.4, iDur*0.2
  aOut vco2 0.3*kEnv, iFreq, 2, 0.5
  aOut moogladder aOut, iFreq*4, 0.3

  aL, aR pan2 aOut, iPan
  outs aL, aR
endin`,
  },
  {
    id: 'weather-sonification',
    name: 'Weather Sonification',
    desc: 'Real-time Open-Meteo API data → Markov chords, 7 scales, 4 orchestral palettes',
    icon: '🌤',
    tags: ['sonification', 'API', 'Markov chains', 'generative'],
    csd: `; Weather Sonification - Temperature → pitch
instr 1  ; warm pad
  iTemp = p4  ; temperature in Celsius
  iFreq = 220 * semitone(iTemp - 20)

  aOsc1 vco2 0.2, iFreq, 0
  aOsc2 vco2 0.15, iFreq*1.002, 0
  aMix = aOsc1 + aOsc2
  aMix moogladder aMix, 800 + iTemp*40, 0.4

  kEnv madsr 2, 1, 0.7, 3
  outs aMix*kEnv, aMix*kEnv
endin`,
  },
]

export default function WebAppsPage() {
  const [selectedApp, setSelectedApp] = useState<AppTemplate | null>(null)
  const [appCode, setAppCode] = useState('')
  const { setCsdContent } = useEditorStore()

  const handleSelectApp = (app: AppTemplate) => {
    setSelectedApp(app)
    setAppCode(buildHtmlApp(app))
  }

  const handleLoadInEditor = () => {
    if (selectedApp) {
      setCsdContent(buildFullCsd(selectedApp))
    }
  }

  return (
    <div style={styles.container}>
      {!selectedApp ? (
        /* Gallery view */
        <>
          <div style={styles.header}>
            <h1 style={styles.title}>Web Apps</h1>
            <p style={styles.subtitle}>
              Build interactive Csound web applications. Start from a reference app or create from scratch.
            </p>
          </div>

          <div style={styles.gallery}>
            <button style={styles.newCard} onClick={() => setSelectedApp({
              id: 'new', name: 'New App', desc: '', icon: '+', tags: [],
              csd: '; Start your instrument here\ninstr 1\n  aOut oscili 0.5, 440\n  outs aOut, aOut\nendin',
            })}>
              <span style={styles.newIcon}>+</span>
              <span style={styles.newLabel}>New App</span>
              <span style={styles.newHint}>Start from scratch</span>
            </button>

            {REFERENCE_APPS.map((app) => (
              <button
                key={app.id}
                style={styles.card}
                onClick={() => handleSelectApp(app)}
              >
                <div style={styles.cardPreview}>
                  <span style={styles.cardEmoji}>{app.icon}</span>
                </div>
                <div style={styles.cardInfo}>
                  <span style={styles.cardName}>{app.name}</span>
                  <span style={styles.cardDesc}>{app.desc}</span>
                  <div style={styles.cardTags}>
                    {app.tags.map((t) => (
                      <span key={t} style={styles.tag}>{t}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        /* Editor view */
        <div style={styles.editorView}>
          <div style={styles.editorToolbar}>
            <button onClick={() => setSelectedApp(null)} style={styles.backButton}>← Back</button>
            <span style={styles.appTitle}>{selectedApp.icon} {selectedApp.name}</span>
            <div style={styles.toolbarActions}>
              <button onClick={handleLoadInEditor} style={styles.toolbarButton}>
                Open in CSD Editor
              </button>
              <button style={styles.toolbarButtonPrimary}>
                ▶ Preview
              </button>
            </div>
          </div>

          <div style={styles.editorSplit}>
            {/* Code */}
            <div style={styles.codePanel}>
              <div style={styles.codePanelHeader}>
                <span style={styles.fileName}>index.html</span>
              </div>
              <textarea
                value={appCode || buildHtmlApp(selectedApp)}
                onChange={(e) => setAppCode(e.target.value)}
                style={styles.codeArea}
                spellCheck={false}
              />
            </div>

            {/* Preview / CSD */}
            <div style={styles.previewPanel}>
              <div style={styles.codePanelHeader}>
                <span style={styles.fileName}>Embedded CSD</span>
              </div>
              <pre style={styles.csdPreview}>{selectedApp.csd}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function buildFullCsd(app: AppTemplate): string {
  return `<CsoundSynthesizer>
<CsOptions>
-odac -d -m0
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1

${app.csd}

</CsInstruments>
<CsScore>
i 1 0 4 440 0.5
i 1 1 3 554 0.4
i 1 2 4 330 0.45
</CsScore>
</CsoundSynthesizer>`
}

function buildHtmlApp(app: AppTemplate): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${app.name} — DrC Web App</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #111110; color: #e8e6e1;
      font-family: 'Inter', system-ui, sans-serif;
      display: flex; flex-direction: column;
      align-items: center; padding: 40px;
      min-height: 100vh;
    }
    h1 { font-weight: 300; letter-spacing: 0.04em; margin-bottom: 8px; }
    .subtitle { color: #8a8884; font-size: 14px; margin-bottom: 32px; }
    .controls { display: flex; gap: 12px; margin-bottom: 24px; }
    button {
      padding: 10px 24px; border-radius: 10px;
      border: 1.5px solid #2a2926; background: transparent;
      color: #e8e6e1; font-size: 14px; cursor: pointer;
      font-family: inherit; transition: all 150ms ease;
    }
    button:active { transform: scale(0.96); }
    button.play { border-color: #7cb8a4; color: #7cb8a4; }
    button.play:hover { background: rgba(124,184,164,0.1); }
    canvas { border-radius: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>${app.icon} ${app.name}</h1>
  <p class="subtitle">${app.desc}</p>
  <div class="controls">
    <button class="play" onclick="startCsound()">▶ Play</button>
    <button onclick="stopCsound()">■ Stop</button>
  </div>
  <canvas id="waveform" width="600" height="120"></canvas>

  <script type="text/csound" id="csd">
${buildFullCsd(app)}
  </script>

  <script type="module">
    import { Csound } from "https://unpkg.com/@csound/browser@6.18.7/dist/csound.js";

    let csound = null;

    window.startCsound = async () => {
      if (!csound) {
        csound = await Csound();
      }
      const csd = document.getElementById('csd').textContent;
      await csound.compileCsdText(csd);
      await csound.start();
    };

    window.stopCsound = async () => {
      if (csound) await csound.stop();
    };
  </script>
</body>
</html>`
}

const styles: Record<string, CSSProperties> = {
  container: { height: '100%', overflow: 'auto' },
  header: { padding: '40px 40px 0' },
  title: { fontSize: 28, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '0.04em', marginBottom: 8 },
  subtitle: { fontSize: 14, color: 'var(--text-muted)', maxWidth: 500, lineHeight: 1.5 },
  gallery: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: 16, padding: '32px 40px 40px',
  },
  newCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 8, minHeight: 220, border: 'var(--border-width) dashed var(--border)',
    borderRadius: 'var(--panel-radius)', background: 'transparent',
    color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 150ms ease',
    textAlign: 'center',
  },
  newIcon: { fontSize: 36, fontWeight: 300 },
  newLabel: { fontSize: 14, fontWeight: 500, letterSpacing: '0.04em' },
  newHint: { fontSize: 12, opacity: 0.5 },
  card: {
    display: 'flex', flexDirection: 'column',
    border: 'var(--border-width) solid var(--border)', borderRadius: 'var(--panel-radius)',
    background: 'var(--bg-secondary)', overflow: 'hidden', cursor: 'pointer',
    transition: 'all 150ms ease', textAlign: 'left',
  },
  cardPreview: {
    height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-tertiary)',
  },
  cardEmoji: { fontSize: 40 },
  cardInfo: { padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 },
  cardName: { fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' },
  cardDesc: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 },
  cardTags: { display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 },
  tag: {
    fontSize: 10, color: 'var(--accent)', background: 'var(--accent-muted)',
    padding: '2px 8px', borderRadius: 6, fontWeight: 500,
  },
  // Editor view
  editorView: { height: '100%', display: 'flex', flexDirection: 'column' },
  editorToolbar: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '12px 20px', borderBottom: 'var(--border-width) solid var(--border)',
  },
  backButton: {
    padding: '4px 12px', borderRadius: 6, border: 'var(--border-width) solid var(--border)',
    background: 'transparent', color: 'var(--text-secondary)', fontSize: 13,
    fontFamily: 'var(--font-primary)', cursor: 'pointer',
  },
  appTitle: { fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', flex: 1 },
  toolbarActions: { display: 'flex', gap: 8 },
  toolbarButton: {
    padding: '6px 16px', borderRadius: 8, border: 'var(--border-width) solid var(--border)',
    background: 'transparent', color: 'var(--text-secondary)', fontSize: 13,
    fontFamily: 'var(--font-primary)', cursor: 'pointer',
  },
  toolbarButtonPrimary: {
    padding: '6px 16px', borderRadius: 8, border: 'none',
    background: 'var(--accent)', color: 'var(--bg-primary)', fontSize: 13,
    fontWeight: 500, fontFamily: 'var(--font-primary)', cursor: 'pointer',
  },
  editorSplit: { flex: 1, display: 'flex', overflow: 'hidden' },
  codePanel: {
    flex: 1, display: 'flex', flexDirection: 'column',
    borderRight: 'var(--border-width) solid var(--border)',
  },
  codePanelHeader: {
    padding: '8px 16px', borderBottom: 'var(--border-width) solid var(--border-subtle)',
  },
  fileName: { fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  codeArea: {
    flex: 1, resize: 'none', border: 'none', padding: 16,
    fontSize: 13, fontFamily: 'var(--font-mono)', lineHeight: 1.6,
    background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none',
    tabSize: 2,
  },
  previewPanel: { flex: 1, display: 'flex', flexDirection: 'column' },
  csdPreview: {
    flex: 1, padding: 16, fontSize: 13, fontFamily: 'var(--font-mono)',
    lineHeight: 1.6, color: 'var(--accent)', background: 'var(--bg-primary)',
    overflow: 'auto', whiteSpace: 'pre-wrap',
  },
}
