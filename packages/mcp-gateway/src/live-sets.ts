/**
 * The center's declarations, in the shape the door decides with.
 *
 * The door asks the registry the same question on every call and the answer
 * changes only when the center writes, so the registry is rebuilt when the
 * center's revision moves and not on a clock — the same reason the catalog is
 * rebuilt on a topology change. A gateway with a timer would decide with a
 * binding its operator has already replaced, for as long as the timer's period.
 *
 * A build is total. Every set the center stores has been parsed by the one
 * mcpset grammar and checked against the servers it names, and that grammar
 * refuses what this registry would throw on (`set-schema.ts`), so a rebuild
 * cannot fail halfway and leave the door holding half a topology.
 *
 * Nothing here writes. What the center declares is the door's to read, so this
 * is an `McpSetReader`: a surface that could add a set could add one the center
 * has never heard of, and the door would then enforce something no operator
 * declared.
 */
import { makeMcpSetRegistry, type McpSetRegistryOptions } from "./sets.ts"
import type { McpSetFacts, McpSetSlot } from "./set-source.ts"
import type { McpSetReader, McpSetQuery, McpSetRegistry, McpSetResolution } from "./contract-sets.ts"

export interface LiveSets extends McpSetReader {
  /** The declarations as of the build in hand — what a console draws beside the verdict. */
  facts(): McpSetFacts
}

/** No source is no sets: an app that never said where they live holds none. */
const NONE: McpSetFacts = { revision: -1, sets: [], bindings: [] }

export const makeLiveSets = (
  slot: McpSetSlot | undefined,
  resolver?: McpSetRegistryOptions["resolver"],
): LiveSets => {
  // Asked of the seam on every read, not taken once at load: apps are loaded in
  // the order their roots were discovered, and a door that captured a source at
  // load would hold no sets at all — for as long as it ran — if the center
  // happened to be loaded second. Asking is a property read; the rebuild below is
  // the part that costs, and it still only happens when the revision moves.
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
