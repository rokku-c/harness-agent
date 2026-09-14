import type { McpSet, McpSetBinding } from "./contract-sets.ts"

export interface McpSetFacts {
  readonly revision: number
  readonly sets: readonly McpSet[]
  readonly bindings: readonly McpSetBinding[]
}

export interface McpSetSource { facts(): McpSetFacts }

export interface McpSetSlot {
  provide(provider: string, source: McpSetSource): void
  source(): McpSetSource | undefined
}

export const makeMcpSetSlot = (): McpSetSlot => {
  let held: { readonly provider: string; readonly source: McpSetSource } | undefined
  return {
    provide: (provider, source) => {
      if (held !== undefined && held.provider !== provider) {
        throw new Error(`the MCP sets are ${held.provider}'s to declare; ${provider} cannot take them`)
      }
      held = { provider, source }
    },
    source: () => held?.source,
  }
}
