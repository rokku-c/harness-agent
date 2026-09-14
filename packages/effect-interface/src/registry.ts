import type { EffectApp, EffectInterface, ToolJsonSchema } from "./contract.ts"
import { revocable } from "./revocable.ts"
import { keyOf, schemaOf, type ToolEntry } from "./tool-key.ts"

export type { ToolEntry } from "./tool-key.ts"

export interface RegisteredApp {
  readonly interfaceId: string
  readonly app: EffectApp
}

export interface EffectRegistry {
  registerInterface(iface: EffectInterface): () => void
  tools(): readonly ToolEntry[]
  apps(): readonly RegisteredApp[]
  find(interfaceId: string): EffectInterface | undefined
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

  const apps = (): readonly RegisteredApp[] => {
    const out: RegisteredApp[] = []
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
