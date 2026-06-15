#!/usr/bin/env node
//
// Workshop readiness test — run before LAC sessions:
//
//     node scripts/workshop-test.mjs
//
// Runs smoke tests + memory check + starter compiles. Exits non-zero on failure.

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))

function run(label, cmd, args, opts = {}) {
  console.log(`\n▶ ${label}`)
  const r = spawnSync(cmd, args, { cwd: REPO, stdio: 'inherit', ...opts })
  if (r.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${r.status ?? 'signal'})`)
    process.exit(r.status ?? 1)
  }
}

run('Platform launchers', 'node', ['scripts/test-platform-launchers.mjs'])
run('Smoke test suite', 'node', ['scripts/smoke-test.mjs'])
run('Memory module check', 'npm', ['run', 'check-memory', '--silent'])
run('Production build', 'npm', ['run', 'build'], { timeout: 120_000 })

console.log('\n✓ Workshop tests passed — safe to demo Agent, Player, Web Apps, CsoundQt.')
