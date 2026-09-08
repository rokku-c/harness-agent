/**
 * app-one bundle entry — the compiled artifact "registers itself back".
 *
 * It only depends on the api passed by the loader (no hard import of the
 * hosting process), so the same entry works when loaded in-process or through
 * a remote-effect api.
 */

import type { EffectRegistry } from "@effect-agent/effect-interface"

export interface AppOneApi {
  readonly namespace?: string
  readonly registry: EffectRegistry
}

export const register = async (api: AppOneApi): Promise<() => void> => {
  const ns = api.namespace ?? "ops"
  return api.registry.registerInterface({
    id: `${ns}::app-one`,
    title: "App one",
    description: "demo bundle app",
    tools: [
      {
        name: "echo",
        description: "echo text back",
        inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
        handler: async (args: unknown) => {
          const text = (args as { text: string }).text
          return { text }
        },
      },
    ],
  })
}
