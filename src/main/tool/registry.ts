// Import all tools to register them
import { csoundCompile } from './csound_compile'
import { csoundRender } from './csound_render'
import { csoundSmoke } from './csound_smoke'
import { writeFile } from './write_file'
import { readFile } from './read_file'
import { applyCsdPatch } from './apply_csd_patch'
import { bash } from './bash'
import { Tool } from './tool'

// Force registration by importing
const _tools = [csoundCompile, csoundRender, csoundSmoke, writeFile, readFile, applyCsdPatch, bash]

export { Tool }
