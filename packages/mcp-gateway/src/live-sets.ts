import { makeMcpSetRegistry, type McpSetRegistryOptions } from "./sets.ts"
import type { McpSetFacts, McpSetSlot } from "./set-source.ts"
import type { McpSetReader, McpSetQuery, McpSetRegistry, McpSetResolution } from "./contract-sets.ts"

export interface LiveSets extends McpSetReader {
  facts(): McpSetFacts
}

const NONE: McpSetFacts = { revision: -1, sets: [], bindings: [] }

export const makeLiveSets = (
  slot: McpSetSlot | undefined,
  resolver?: McpSetRegistryOptions["resolver"],
): LiveSets => {
  const facts = (): McpSetFacts => slot?.source()?.facts() ?? NONE
  let built: { readonly revision: number; readonly registry: McpSetRegistry } | undefined
  const current = (): McpSetRegistry => {
    const now = facts()
    if (built?.revision !== now.revision) {
      const registry = makeMcpSetRegistry(resolver === undefined ? {} : { resolver })
      for (const set of now.sets) registry.registerSet(set)
      for (const binding of now.bindings) registry.bindAgent(binding)
      built = { revision: now.revision, registry }
    }
    return built.registry
  }
  return {
    facts,
    bound: (agent) => current().bound(agent),
    resolve: (query: McpSetQuery): McpSetResolution | undefined => current().resolve(query),
  }
}
