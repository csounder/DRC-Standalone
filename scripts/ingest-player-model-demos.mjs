#!/usr/bin/env node
/**
 * Copy Dr. B's selected MIDI synth models into workshop-starters for the Player demo menu.
 *
 *   node scripts/ingest-player-model-demos.mjs
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  copyFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const OUT_ROOT = join(REPO, 'resources/workshop-starters/models')
const MANIFEST_OUT = join(REPO, 'resources/workshop-starters/player-model-demos.json')

/** @type {{ type: 'dir' | 'file', path: string, group: string, demoOrder: number }[]} */
const SOURCES = [
  {
    type: 'dir',
    path: '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - Bass',
    group: 'Bass',
    demoOrder: 200,
  },
  {
    type: 'dir',
    path: '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - Chinese Instruments',
    group: 'Chinese Instruments',
    demoOrder: 210,
  },
  {
    type: 'dir',
    path: '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - Crickets - Hans Mikelson',
    group: 'Crickets',
    demoOrder: 220,
  },
  {
    type: 'dir',
    path: '/Users/richardboulanger/Desktop/Selected Csound/Filter - DiodeLadder',
    group: 'Filters',
    demoOrder: 230,
  },
  {
    type: 'dir',
    path: '/Users/richardboulanger/Desktop/Selected Csound/SYNTH - PulseWidthMod',
    group: 'Pulse Width Mod',
    demoOrder: 240,
  },
  {
    type: 'file',
    path:
      '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - Physical Model - HandPan/handpan1/handpan.csd',
    group: 'HandPan',
    demoOrder: 250,
  },
  {
    type: 'file',
    path:
      '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - Physical Model - HandPan/handpan2/handpan.csd',
    group: 'HandPan',
    demoOrder: 251,
  },
  {
    type: 'dir',
    path: '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - Granular - Eugenio Giordani',
    group: 'Granular',
    demoOrder: 260,
  },
  {
    type: 'file',
    path: '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - FM/FM_Bell_Bass_Clairnet_Wood.csd',
    group: 'FM',
    demoOrder: 270,
  },
  {
    type: 'file',
    path: '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - FM/FM_StringPad.csd',
    group: 'FM',
    demoOrder: 271,
  },
  {
    type: 'dir',
    path: '/Users/richardboulanger/Desktop/SYNTH - MISC',
    group: 'Misc Synths',
    demoOrder: 280,
  },
  {
    type: 'dir',
    path: '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - Pads',
    group: 'Pads',
    demoOrder: 290,
  },
  {
    type: 'dir',
    path: '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - AnalogSynth - Steven Cook',
    group: 'Analog Synth',
    demoOrder: 300,
  },
  {
    type: 'dir',
    path: '/Users/richardboulanger/dB-Studio/Csound/MODELS/SYNTH - CZsynth',
    group: 'CZ Synth',
    demoOrder: 310,
  },
]

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48)
}

function titleFromFile(file) {
  return basename(file, '.csd')
    .replace(/^_/g, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_+]+/g, ' ')
    .trim()
}

function collectCsdFiles(root, type) {
  if (type === 'file') {
    return existsSync(root) ? [root] : []
  }
  if (!existsSync(root)) {
    console.warn(`SKIP missing: ${root}`)
    return []
  }
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      const st = statSync(p)
      if (st.isDirectory()) walk(p)
      else if (name.toLowerCase().endsWith('.csd')) out.push(p)
    }
  }
  walk(root)
  return out.sort()
}

function destRelPath(group, srcPath, srcRoot) {
  const groupSlug = slug(group)
  const base = basename(srcPath)
  if (srcRoot && typeIsDir(srcRoot)) {
    const rel = relative(srcRoot, srcPath).replace(/\\/g, '/')
    return `models/${groupSlug}/${rel}`
  }
  const parent = slug(basename(dirname(srcPath)))
  const stem = slug(basename(srcPath, '.csd')) || 'patch'
  if (parent && parent !== groupSlug && stem === parent) {
    return `models/${groupSlug}/${parent}/${base}`
  }
  if (parent && parent !== groupSlug && stem !== 'handpan' && stem !== 'patch') {
    return `models/${groupSlug}/${parent}_${base}`
  }
  if (parent && parent !== groupSlug) {
    return `models/${groupSlug}/${parent}/${base}`
  }
  return `models/${groupSlug}/${base}`
}

function typeIsDir(p) {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** @type {Map<string, object>} */
const byId = new Map()

for (const src of SOURCES) {
  const files = collectCsdFiles(src.path, src.type)
  let order = src.demoOrder
  for (const file of files) {
    const rel = destRelPath(src.group, file, src.type === 'dir' ? src.path : null)
    const dest = join(REPO, 'resources/workshop-starters', rel)
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(file, dest)

    const stem = basename(rel, '.csd')
    const id = `model_${slug(rel.replace(/\//g, '_').replace(/\.csd$/i, ''))}`
    const title =
      basename(file, '.csd').replace(/^_/g, '') === 'handpan'
        ? titleFromFile(dirname(file))
        : titleFromFile(basename(file))
    const entry = {
      id,
      title,
      filename: rel,
      playerDemo: true,
      demoGroup: src.group,
      demoOrder: order++,
      description: `${title} — ${src.group} (Dr. B collection)`,
    }
    byId.set(id, entry)
    console.log(`+ ${rel}`)
  }
}

const manifest = [...byId.values()].sort((a, b) => a.demoOrder - b.demoOrder)
writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
console.log(`\nWrote ${manifest.length} demos → ${MANIFEST_OUT}`)
