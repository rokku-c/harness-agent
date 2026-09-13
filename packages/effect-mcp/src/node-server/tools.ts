import { invoke, type EffectRegistry } from "@effect-agent/effect-interface"
import { zodShape, type JsonSchema } from "./schema.js"

const sanitize = (name: string): string => name.replace(/[^A-Za-z0-9_-]+/g, "_")

/** What a reconcile pass changed on the served tool list. */
export interface ToolChange {
  readonly added: readonly string[]
  readonly removed: readonly string[]
  readonly updated: readonly string[]
}

export const emptyToolChange: ToolChange = { added: [], removed: [], updated: [] }

export const toolChangeIsEmpty = (change: ToolChange): boolean =>
  change.added.length === 0 && change.removed.length === 0 && change.updated.length === 0

/**
 * The live tool surface of a node server.
 *
 * Tools used to be registered once, at build time, from a snapshot of the
 * registry — so an app hot-swap (docs/architecture-rework.md §6.4) left
 * connected agents holding a stale list. The surface reconciles on demand and
 * announces `notifications/tools/list_changed`, which is what §6.5-8 requires.
 */
export interface ToolSurface {
  /** the tool names currently served, in registration order. */
  names(): readonly string[]
  /** re-read the registry and reconcile; announces the change to connected clients. */
  refresh(): ToolChange
}

interface LiveTool {
  readonly signature: string
  readonly handle: { remove(): void }
}

/** Identity of a tool as the client sees it — a change here is a change to the surface. */
const signatureOf = (tool: {
  readonly name: string
  readonly title?: string
  readonly description?: string
  readonly inputSchema?: unknown
}): string => JSON.stringify([tool.title ?? tool.name, tool.description ?? tool.name, tool.inputSchema ?? null])

export const registerTools = (server: any, registry: EffectRegistry): ToolSurface => {
  const register = server.registerTool.bind(server) as any
  const live = new Map<string, LiveTool>()

  const add = (tool: any): void => {
    const name = sanitize(tool.name)
    const handle = register(
      name,
      {
        title: tool.title ?? tool.name,
        description: tool.description ?? tool.name,
        inputSchema: zodShape(tool.inputSchema as JsonSchema | undefined),
      },
      async (args: Record<string, unknown>) => {
        try {
          return { content: [{ type: "text", text: JSON.stringify(await invoke(tool, args ?? {})) }] }
        } catch (error) {
          return {
            content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
            isError: true,
          }
        }
      },
    )
    live.set(name, { signature: signatureOf(tool), handle })
  }

  const desired = (): Map<string, any> => {
    const out = new Map<string, any>()
    for (const { tool } of registry.tools()) out.set(sanitize(tool.name), tool)
    return out
  }

  // initial population — no notification: nothing was served before this build.
  for (const tool of desired().values()) add(tool)

  return {
    names: () => [...live.keys()],

    refresh(): ToolChange {
      const wanted = desired()
      const added: string[] = []
      const removed: string[] = []
      const updated: string[] = []

      for (const [name, entry] of [...live]) {
        if (wanted.has(name)) continue
        entry.handle.remove()
        live.delete(name)
        removed.push(name)
      }
      for (const [name, tool] of wanted) {
        const entry = live.get(name)
        if (entry === undefined) {
          add(tool)
          added.push(name)
        } else if (entry.signature !== signatureOf(tool)) {
          entry.handle.remove()
          live.delete(name)
          add(tool)
          updated.push(name)
        }
      }

      const change: ToolChange = { added, removed, updated }
      if (!toolChangeIsEmpty(change)) server.sendToolListChanged()
      return change
    },
  }
}
