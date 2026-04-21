export interface TechniqueLineage {
  name: string
  description: string
  timeline: { year: number; event: string; person?: string }[]
  csoundOpcodes: string[]
  relatedTechniques: string[]
}

export const TECHNIQUE_LINEAGES: TechniqueLineage[] = [
  {
    name: 'FM Synthesis',
    description: 'Frequency Modulation synthesis — using one oscillator to modulate the frequency of another, producing complex spectra from simple components.',
    timeline: [
      { year: 1967, event: 'John Chowning discovers FM synthesis at Stanford', person: 'John Chowning' },
      { year: 1971, event: 'Chowning publishes "The Synthesis of Complex Audio Spectra by Means of Frequency Modulation"' },
      { year: 1973, event: 'Stanford licenses FM patent to Yamaha' },
      { year: 1977, event: 'Chowning composes Stria using golden ratio FM ratios', person: 'John Chowning' },
      { year: 1983, event: 'Yamaha DX7 released — best-selling synth of the 1980s' },
      { year: 1986, event: 'Csound implements foscil and foscili opcodes', person: 'Barry Vercoe' },
      { year: 2000, event: 'Native Instruments FM7/FM8 revives interest in FM' },
    ],
    csoundOpcodes: ['foscil', 'foscili', 'oscili', 'poscil', 'crossfm'],
    relatedTechniques: ['Phase Modulation', 'Waveshaping', 'Additive Synthesis'],
  },
  {
    name: 'Granular Synthesis',
    description: 'Building sound from thousands of tiny grains (1-100ms). Enables time-stretching, spectral freezing, and cloud-like textures.',
    timeline: [
      { year: 1947, event: 'Dennis Gabor theorizes granular sound representation', person: 'Dennis Gabor' },
      { year: 1971, event: 'Xenakis describes granular composition in Formalized Music', person: 'Iannis Xenakis' },
      { year: 1978, event: 'Curtis Roads implements first computer granular synthesis', person: 'Curtis Roads' },
      { year: 1986, event: 'Barry Truax composes Riverrun — landmark granular piece', person: 'Barry Truax' },
      { year: 1990, event: 'Csound grain opcode family developed' },
      { year: 2001, event: 'Curtis Roads publishes Microsound', person: 'Curtis Roads' },
      { year: 2005, event: 'partikkel opcode added to Csound for advanced granular' },
    ],
    csoundOpcodes: ['grain', 'grain2', 'grain3', 'granule', 'partikkel', 'fog', 'syncgrain', 'diskgrain'],
    relatedTechniques: ['Microsound', 'Time-stretching', 'Spectral Processing'],
  },
  {
    name: 'Spectral Processing',
    description: 'Analyzing and manipulating sound in the frequency domain via FFT/STFT. Includes cross-synthesis, spectral morphing, and freezing.',
    timeline: [
      { year: 1822, event: 'Fourier publishes Théorie analytique de la chaleur', person: 'Joseph Fourier' },
      { year: 1965, event: 'Cooley-Tukey FFT algorithm published' },
      { year: 1966, event: 'First musical applications of FFT at Bell Labs' },
      { year: 1977, event: 'IRCAM founded — becomes center for spectral research', person: 'Pierre Boulez' },
      { year: 1990, event: 'Xavier Serra develops SMS (Spectral Modeling Synthesis)', person: 'Xavier Serra' },
      { year: 1998, event: 'Csound pvs opcodes introduced for streaming spectral processing' },
      { year: 2005, event: 'Victor Lazzarini extends Csound spectral toolkit', person: 'Victor Lazzarini' },
    ],
    csoundOpcodes: ['pvsanal', 'pvsynth', 'pvscross', 'pvsmorph', 'pvsfreeze', 'pvsmaska', 'pvsfilter', 'pvshift'],
    relatedTechniques: ['Additive Synthesis', 'Convolution', 'Cross-Synthesis'],
  },
  {
    name: 'Physical Modeling',
    description: 'Simulating the physics of sound-producing mechanisms — strings, tubes, membranes, plates — using mathematical models.',
    timeline: [
      { year: 1971, event: 'Hiller and Ruiz model a vibrating string with finite differences' },
      { year: 1983, event: 'Julius O. Smith develops waveguide synthesis at CCRMA', person: 'Julius O. Smith III' },
      { year: 1992, event: 'Yamaha releases VL1 — first commercial physical modeling synth' },
      { year: 1993, event: 'Perry Cook develops STK (Synthesis ToolKit)', person: 'Perry Cook' },
      { year: 1998, event: 'Csound physical modeling opcodes: wgbow, wgflute, wgclar' },
      { year: 2002, event: 'Faust language developed for DSP/physical modeling', person: 'Yann Orlarey' },
    ],
    csoundOpcodes: ['wgbow', 'wgflute', 'wgclar', 'wgbrass', 'pluck', 'repluck', 'marimba', 'vibes', 'barmodel'],
    relatedTechniques: ['Waveguide Synthesis', 'Modal Synthesis', 'Karplus-Strong'],
  },
  {
    name: 'Additive Synthesis',
    description: 'Building complex sounds by summing individual sine wave partials. Based on Fourier\'s theorem that any periodic wave is a sum of sinusoids.',
    timeline: [
      { year: 1822, event: 'Fourier proves any periodic function decomposes into sines' },
      { year: 1957, event: 'Max Mathews implements additive synthesis in MUSIC I', person: 'Max Mathews' },
      { year: 1965, event: 'Risset analyzes trumpet sounds into partials at Bell Labs', person: 'Jean-Claude Risset' },
      { year: 1969, event: 'Risset composes Mutations using additive paradox tones' },
      { year: 1986, event: 'Csound oscil family provides efficient additive building blocks' },
    ],
    csoundOpcodes: ['oscil', 'oscili', 'poscil', 'poscil3', 'adsynt', 'adsynt2', 'hsboscil'],
    relatedTechniques: ['Spectral Processing', 'Resynthesis', 'Wavetable Synthesis'],
  },
  {
    name: 'Subtractive Synthesis',
    description: 'Starting with harmonically rich waveforms (saw, square, pulse) and filtering to sculpt timbre. Foundation of analog synthesizers.',
    timeline: [
      { year: 1964, event: 'Robert Moog develops voltage-controlled filter', person: 'Robert Moog' },
      { year: 1965, event: 'Don Buchla creates the Buchla 100 modular', person: 'Don Buchla' },
      { year: 1967, event: 'Subotnick composes Silver Apples on Buchla', person: 'Morton Subotnick' },
      { year: 1970, event: 'Minimoog released — subtractive synthesis goes mainstream' },
      { year: 1986, event: 'Csound provides moogvcf, butterlp, reson for digital subtractive' },
      { year: 2000, event: 'moogladder opcode added — faithful Moog ladder emulation' },
    ],
    csoundOpcodes: ['vco2', 'moogladder', 'moogvcf', 'butterlp', 'butterhp', 'butterbp', 'reson', 'svfilter', 'statevar', 'lpf18'],
    relatedTechniques: ['Analog Modeling', 'Filter Design', 'Wavetable Synthesis'],
  },
  {
    name: 'Wavetable Synthesis',
    description: 'Storing waveform cycles in tables (function tables) and reading through them. Foundation of most digital synthesis in Csound.',
    timeline: [
      { year: 1958, event: 'MUSIC II introduces stored waveforms (precursor)', person: 'Max Mathews' },
      { year: 1979, event: 'Fairlight CMI — first commercial wavetable synth' },
      { year: 1983, event: 'PPG Wave popularizes wavetable scanning' },
      { year: 1986, event: 'Csound GEN routines: GEN10, GEN07, GEN05 for table generation' },
      { year: 2007, event: 'Xfer Serum makes wavetable synthesis mainstream again' },
    ],
    csoundOpcodes: ['ftgen', 'oscili', 'tablei', 'tablekt', 'poscil', 'tableikt'],
    relatedTechniques: ['Vector Synthesis', 'Additive Synthesis', 'Sample-Based Synthesis'],
  },
  {
    name: 'Stochastic Synthesis',
    description: 'Using probability distributions and random processes to directly generate waveforms or compositional structures.',
    timeline: [
      { year: 1955, event: 'Xenakis formalizes stochastic music theory', person: 'Iannis Xenakis' },
      { year: 1962, event: 'Xenakis composes ST/10 with IBM 7090 computer' },
      { year: 1971, event: 'Koenig develops Project 1 algorithmic system', person: 'Gottfried Michael Koenig' },
      { year: 1991, event: 'Xenakis creates GENDYN — pure stochastic waveform synthesis' },
      { year: 1998, event: 'Csound random/noise opcodes expanded: gauss, cauchy, weibull' },
    ],
    csoundOpcodes: ['random', 'rand', 'randh', 'randi', 'gauss', 'cauchy', 'weibull', 'jitter', 'jitter2', 'dust', 'dust2', 'gendy'],
    relatedTechniques: ['Noise Synthesis', 'Algorithmic Composition', 'Chaos'],
  },
  {
    name: 'Sample-Based Synthesis',
    description: 'Recording and manipulating audio samples — looping, pitch-shifting, layering, crossfading. Foundation of sampling.',
    timeline: [
      { year: 1969, event: 'Mellotron used by Beatles, King Crimson — tape-based sampling' },
      { year: 1979, event: 'Fairlight CMI — first digital sampler' },
      { year: 1986, event: 'Akai S900 makes sampling affordable' },
      { year: 1986, event: 'Csound loscil opcode for sample playback' },
      { year: 1996, event: 'diskin2 opcode for disk streaming of large files' },
      { year: 2010, event: 'flooper2 opcode for sophisticated looping' },
    ],
    csoundOpcodes: ['loscil', 'loscil3', 'diskin', 'diskin2', 'flooper', 'flooper2', 'sndwarp', 'sndwarpst', 'mincer'],
    relatedTechniques: ['Granular Synthesis', 'Concatenative Synthesis', 'Time-stretching'],
  },
  {
    name: 'Ring Modulation',
    description: 'Multiplying two audio signals to produce sum and difference frequencies. Creates metallic, bell-like, inharmonic timbres.',
    timeline: [
      { year: 1934, event: 'Ring modulator circuits developed for telecommunications' },
      { year: 1956, event: 'Stockhausen uses ring modulation in Gesang der Jünglinge', person: 'Karlheinz Stockhausen' },
      { year: 1960, event: 'Stockhausen employs ring mod extensively in Kontakte' },
      { year: 1963, event: 'BBC Radiophonic Workshop uses ring mod for Doctor Who theme' },
      { year: 1986, event: 'Csound: simple multiplication of two a-rate signals' },
    ],
    csoundOpcodes: ['oscili', 'product (a*a multiplication)'],
    relatedTechniques: ['AM Synthesis', 'FM Synthesis', 'Waveshaping'],
  },
]

export function getLineage(name: string): TechniqueLineage | undefined {
  return TECHNIQUE_LINEAGES.find(
    (t) => t.name.toLowerCase() === name.toLowerCase()
  )
}

export function getAllTechniqueNames(): string[] {
  return TECHNIQUE_LINEAGES.map((t) => t.name)
}
