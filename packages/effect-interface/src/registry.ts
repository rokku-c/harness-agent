/**
 * effect-interface registry — registration of schema-exportable interfaces.
 *
 * Mirrors the deepseek-harness idea that registration is a reversible effect:
 * `registerInterface(...)` returns a disposer that removes exactly the records
 * it added, so disabling a plugin/app leaves the registry provably clean.
 * `Formal/Lifecycle.lean` proves register and dispose are symmetric, and that a
 * stale disposer cannot revoke the registration that replaced it.
 *
 * The flat key a tool is addressed by and the schema it is advertised by are
 * `tool-key.ts`; this file owns the records and the lookups over them.
 */

import type { EffectApp, EffectInterface, ToolJsonSchema } from "./contract.ts"
import { revocable } from "./revocable.ts"
import { keyOf, schemaOf, type ToolEntry } from "./tool-key.ts"

export type { ToolEntry } from "./tool-key.ts"

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
