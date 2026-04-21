import { z } from 'zod'

export interface ToolMetadata {
  [key: string]: any
}

export interface ToolResult<M extends ToolMetadata = ToolMetadata> {
  title: string
  metadata: M
  output: string
}

export interface ToolContext {
  sessionID: string
  messageID: string
  agent: string
  abort: AbortSignal
  callID?: string
}

export interface ToolDefinition<P extends z.ZodType = z.ZodType, M extends ToolMetadata = ToolMetadata> {
  id: string
  description: string
  parameters: P
  execute(args: z.infer<P>, ctx: ToolContext): Promise<ToolResult<M>>
}

const registry = new Map<string, ToolDefinition>()

export namespace Tool {
  export function define<P extends z.ZodType, M extends ToolMetadata = ToolMetadata>(
    id: string,
    def: Omit<ToolDefinition<P, M>, 'id'>
  ): ToolDefinition<P, M> {
    const tool = { id, ...def }
    registry.set(id, tool as any)
    return tool
  }

  export function get(id: string): ToolDefinition | undefined {
    return registry.get(id)
  }

  export function all(): ToolDefinition[] {
    return Array.from(registry.values())
  }

  export function ids(): string[] {
    return Array.from(registry.keys())
  }

  // Sine mode gets a reduced tool set
  const SINE_MODE_TOOLS = new Set([
    'csound_compile', 'csound_render', 'csound_smoke',
    'write_file', 'read_file', 'apply_csd_patch',
    'bash', 'glob', 'grep', 'edit',
  ])

  export function forAgent(agentName: string, options: Record<string, any> = {}): ToolDefinition[] {
    if (options.sineMode) {
      return all().filter((t) => SINE_MODE_TOOLS.has(t.id))
    }
    return all()
  }
}
