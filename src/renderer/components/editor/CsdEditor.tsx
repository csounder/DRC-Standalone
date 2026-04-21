import { useRef, useEffect } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useEditorStore } from '../../stores/editorStore'

// Csound language definition for Monaco
const CSOUND_LANG_ID = 'csound'

function registerCsoundLanguage(monaco: any) {
  if (monaco.languages.getLanguages().some((l: any) => l.id === CSOUND_LANG_ID)) return

  monaco.languages.register({ id: CSOUND_LANG_ID, extensions: ['.csd', '.orc', '.sco'] })

  monaco.languages.setMonarchTokensProvider(CSOUND_LANG_ID, {
    keywords: [
      'instr', 'endin', 'opcode', 'endop', 'if', 'then', 'else', 'elseif', 'endif',
      'while', 'do', 'od', 'until', 'goto', 'igoto', 'kgoto', 'tigoto', 'loop_lt',
      'loop_le', 'loop_gt', 'loop_ge', 'return', 'rireturn', 'turnoff', 'turnoff2',
    ],
    opcodes: [
      'oscil', 'oscili', 'oscils', 'poscil', 'poscil3', 'vco2', 'buzz', 'gbuzz',
      'foscil', 'foscili', 'phasor', 'table', 'tablei', 'tablekt',
      'moogvcf', 'moogladder', 'butterlp', 'butterhp', 'butterbp', 'butterbr',
      'tone', 'atone', 'reson', 'areson', 'bqrez', 'svfilter', 'statevar',
      'lowpass2', 'hilbert', 'phaser1', 'phaser2',
      'linen', 'linenr', 'linseg', 'linsegr', 'expseg', 'expsegr', 'adsr', 'madsr', 'xadsr',
      'envlpx', 'transeg', 'expon', 'line',
      'reverbsc', 'reverb', 'nreverb', 'freeverb', 'alpass', 'comb', 'nestedap',
      'delay', 'delayr', 'delayw', 'deltap', 'deltapi', 'deltapn', 'vdelay', 'vdelay3',
      'pan2', 'pan', 'locsig', 'locsend', 'hrtfmove', 'hrtfstat',
      'diskin', 'diskin2', 'soundin', 'loscil', 'loscil3', 'flooper2',
      'ftgen', 'ftgentmp', 'ftfree', 'ftlen', 'ftsr', 'tableng',
      'outs', 'outall', 'out', 'outc', 'inch', 'ins',
      'chnget', 'chnset', 'chn_k', 'chn_a', 'chn_S', 'invalue', 'outvalue',
      'prints', 'printk', 'printk2', 'printks',
      'random', 'rand', 'randh', 'randi', 'rnd', 'birnd', 'gauss', 'jitter', 'jitter2',
      'ampdb', 'dbamp', 'cpspch', 'cpsoct', 'pchoct', 'octpch', 'cpsmidinn',
      'midiin', 'notnum', 'veloc', 'massign', 'pgmassign', 'ctrl7', 'ctrl14',
      'schedule', 'event', 'scoreline', 'turnoff', 'turnoff2', 'active', 'nstrnum',
      'sr', 'ksmps', 'nchnls', 'nchnls_i', '0dbfs', 'seed',
      'grain', 'grain2', 'grain3', 'granule', 'partikkel', 'fog', 'fof', 'fof2',
      'pvsanal', 'pvsynth', 'pvscross', 'pvsmorph', 'pvsfreeze', 'pvsmaska',
      'pluck', 'wgbow', 'wgflute', 'wgclar', 'wgbrass', 'marimba', 'vibes',
      'setControlChannel', 'inputMessage',
    ],
    typeKeywords: ['ga', 'gi', 'gk', 'gS', 'a', 'i', 'k', 'S', 'w', 'f', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
    tokenizer: {
      root: [
        [/<CsoundSynthesizer>|<\/CsoundSynthesizer>/, 'tag'],
        [/<CsOptions>|<\/CsOptions>/, 'tag'],
        [/<CsInstruments>|<\/CsInstruments>/, 'tag'],
        [/<CsScore>|<\/CsScore>/, 'tag'],
        [/;.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"[^"]*"/, 'string'],
        [/\b(instr|endin|opcode|endop)\b/, 'keyword'],
        [/\b(if|then|else|elseif|endif|while|do|od|until|goto|igoto|kgoto)\b/, 'keyword.control'],
        [/\b(sr|ksmps|nchnls|nchnls_i|0dbfs|seed)\b/, 'keyword.header'],
        [/\b[ai]\w+/, 'variable.rate'],  // a-rate and i-rate variables
        [/\bk\w+/, 'variable.krate'],     // k-rate variables
        [/\bg[aik]\w+/, 'variable.global'], // global variables
        [/\bp[1-9]\d*/, 'variable.pfield'],  // p-fields
        [/\b\d+(\.\d+)?/, 'number'],
        [/[+\-*/=<>!&|^~%]/, 'operator'],
        [/\bf\s+\d+/, 'function.table'],  // f-table statements in score
        [/\bi\s+\d+/, 'function.instr'],  // i-statements in score
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
    },
  })

  monaco.editor.defineTheme('drc-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'tag', foreground: '7cb8a4', fontStyle: 'bold' },
      { token: 'comment', foreground: '484f58', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c5a3d9', fontStyle: 'bold' },
      { token: 'keyword.control', foreground: 'c5a3d9' },
      { token: 'keyword.header', foreground: 'f0b27a', fontStyle: 'bold' },
      { token: 'string', foreground: 'a8d5a2' },
      { token: 'number', foreground: 'f4a6a0' },
      { token: 'operator', foreground: '8b949e' },
      { token: 'variable.rate', foreground: '7eb8da' },
      { token: 'variable.krate', foreground: '58a6ff' },
      { token: 'variable.global', foreground: 'D4748A' },
      { token: 'variable.pfield', foreground: 'f0b27a' },
      { token: 'function.table', foreground: '3D8B8B' },
      { token: 'function.instr', foreground: '5B8C5A' },
    ],
    colors: {
      'editor.background': '#111110',
      'editor.foreground': '#e8e6e1',
      'editor.lineHighlightBackground': '#1a191822',
      'editor.selectionBackground': '#7cb8a425',
      'editorCursor.foreground': '#7cb8a4',
      'editorLineNumber.foreground': '#2a2926',
      'editorLineNumber.activeForeground': '#6a6864',
      'editor.inactiveSelectionBackground': '#7cb8a415',
      'editorIndentGuide.background': '#1f1e1d',
      'editorIndentGuide.activeBackground': '#2a2926',
    },
  })
}

const DEFAULT_CSD = `<CsoundSynthesizer>
<CsOptions>
-odac -d -m0
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1

; Simple FM bell
instr 1
  iFreq = p4
  iAmp = p5
  iModRatio = 3.5
  iModIndex = 8

  ; Modulator
  kModEnv expseg iModIndex, p3*0.8, 0.1, p3*0.2, 0.01
  aMod oscili iFreq * iModRatio * kModEnv, iFreq * iModRatio

  ; Carrier
  kAmpEnv expseg iAmp, p3*0.01, iAmp, p3*0.99, 0.001
  aOut oscili kAmpEnv, iFreq + aMod

  outs aOut, aOut
endin

</CsInstruments>
<CsScore>
; FM Bell melody
i 1 0   2   440   0.4
i 1 0.5 1.5 554   0.3
i 1 1   2   660   0.35
i 1 1.5 1.5 880   0.25
i 1 2   3   330   0.4
i 1 2.5 2   440   0.3
i 1 3   2   554   0.35
i 1 4   4   220   0.45
</CsScore>
</CsoundSynthesizer>`

export default function CsdEditor() {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const { csdContent, setCsdContent } = useEditorStore()

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    registerCsoundLanguage(monaco)
    monaco.editor.setTheme('drc-dark')
    editor.getModel()?.setLanguage?.(CSOUND_LANG_ID)

    // Set initial content if empty
    if (!csdContent) {
      setCsdContent(DEFAULT_CSD)
    }
  }

  return (
    <Editor
      height="100%"
      language={CSOUND_LANG_ID}
      value={csdContent || DEFAULT_CSD}
      onChange={(value) => setCsdContent(value || '')}
      onMount={handleMount}
      theme="drc-dark"
      options={{
        fontFamily: '"SF Mono", "Fira Code", Consolas, monospace',
        fontSize: 13,
        lineHeight: 1.6,
        tabSize: 2,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: 'line',
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        bracketPairColorization: { enabled: true },
        guides: { indentation: true },
        wordWrap: 'off',
        automaticLayout: true,
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
        },
      }}
    />
  )
}
