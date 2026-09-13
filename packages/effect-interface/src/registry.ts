/**
 * effect-interface registry — registration of schema-exportable interfaces.
 *
 * Mirrors the deepseek-harness idea that registration is a reversible effect:
 * `registerInterface(...)` returns a disposer that removes exactly the records
 * it added, so disabling a plugin/app leaves the registry provably clean.
 * Interfaces are looked up by id or by flattened "id.tool" keys, and any of
 * them can be projected to JSON Schema for serving over MCP or docs.
 */

import type { EffectApp, EffectInterface, EffectTool, ToolJsonSchema } from "./contract.ts"
import { toJsonSchema } from "./contract.ts"
import { revocable } from "./revocable.ts"

export interface ToolEntry {
  readonly key: string
  readonly interfaceId: string
  readonly tool: EffectTool
}

export interface AppEntry {
  readonly interfaceId: string
  readonly app: EffectApp
}

export interface EffectRegistry {
  /** register an interface; returns a disposer that unregisters it. */
  registerInterface(iface: EffectInterface): () => void
  /** flat view of every registered tool, keyed "interfaceId.toolName". */
  tools(): readonly ToolEntry[]
  /** flat view of every registered UI app (interfaceId + app). */
  apps(): readonly AppEntry[]
  find(interfaceId: string): EffectInterface | undefined
  /** JSON-Schema projection used to drive MCP/docs. */
  schemas(): readonly ToolJsonSchema[]
  schemaFor(key: string): ToolJsonSchema | undefined
}

export const makeEffectRegistry = (): EffectRegistry => {
  const interfaces = new Map<string, EffectInterface>()

  const keyOf = (ifaceId: string, toolName: string): string => ifaceId + "." + toolName

  const tools = (): readonly ToolEntry[] => {
    const out: ToolEntry[] = []
    for (const iface of interfaces.values()) {
      for (const tool of iface.tools) {
        out.push({ key: keyOf(iface.id, tool.name), interfaceId: iface.id, tool })
      }
    }
    return out
  }

  const apps = (): readonly AppEntry[] => {
    const out: AppEntry[] = []
    for (const iface of interfaces.values()) {
      for (const app of iface.apps ?? []) {
        out.push({ interfaceId: iface.id, app })
      }
    }
    return out
  }

  const schemaOf = (ifaceId: string, tool: EffectTool): ToolJsonSchema => {
    const parameters =
      tool.inputSchema ?? (tool.input !== undefined ? toJsonSchema(tool.input) : undefined) ?? { type: "object" }
    const output =
      tool.outputSchema ?? (tool.output !== undefined ? toJsonSchema(tool.output) : undefined)
    return {
      name: keyOf(ifaceId, tool.name),
      description: tool.description,
      parameters,
      ...(output !== undefined ? { output } : {}),
    }
  }

  return {
    registerInterface(iface: EffectInterface): () => void {
      return revocable(interfaces, iface.id, iface)
    },

    tools,

    apps,

    find: (interfaceId: string): EffectInterface | undefined => interfaces.get(interfaceId),

    schemas(): readonly ToolJsonSchema[] {
      const out: ToolJsonSchema[] = []
      for (const iface of interfaces.values()) {
        for (const tool of iface.tools) out.push(schemaOf(iface.id, tool))
      }
      return out
    },

    schemaFor(key: string): ToolJsonSchema | undefined {
      for (const iface of interfaces.values()) {
        const tool = iface.tools.find((t) => keyOf(iface.id, t.name) === key)
        if (tool !== undefined) return schemaOf(iface.id, tool)
      }
      return undefined
    },
  }
}
