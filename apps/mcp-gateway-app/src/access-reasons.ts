/**
 * Why the gateway refused — the four answers, and which of them is true.
 *
 * Every refusal is one of exactly four facts, and they are ordered most
 * specific first, so an operator reads the first thing that is actually wrong
 * rather than a fact that only holds because something above it did not: a name
 * no server offers, no binding at all, no bound set that reaches a server, or a
 * set that reaches one and refuses the tool by name. Each is a fact about a
 * different object — the catalog, the bindings, the registry, a set's lists —
 * so a page can only ever state one of them.
 *
 * The two ways a walk can reach nothing are told apart by asking the engine a
 * second time, without the server: an agent that reaches *some* server is one
 * whose sets do not hold this one, and "no bound set has a reachable server"
 * would be a different fact about a different object. That second reading is
 * the only reason this file asks the engine rather than reading the verdict.
 *
 * The tool is named the way the list that refused it is written. A set groups
 * servers, so its lists hold the tool's own name — `read` there means read on
 * any of them — and naming the advertised name instead would send an operator
 * to write an entry that list never matches.
 */
import type { CatalogEntry, McpSetRegistry, McpSetResolution } from "@effect-agent/mcp-gateway"

/** What the verdict was, and everything a sentence about it can be built from. */
export interface Refusal {
  readonly sets: McpSetRegistry
  readonly agentId: string
  /** Whether the agent is bound to any set at all. */
  readonly bound: boolean
  /** The name the operator asked about, as the door advertises it. */
  readonly tool?: string
  /** The catalog's own entry for it, or nothing when no server offers it. */
  readonly entry?: CatalogEntry
  /** The engine's answer, or nothing when no bound set reached a server. */
  readonly resolution?: McpSetResolution
}

export const refusalReasons = (refusal: Refusal): readonly string[] => {
  const { sets, agentId, bound, tool, entry, resolution } = refusal
  if (tool !== undefined && entry === undefined) return [`no server offers ${tool}`]
  if (!bound) return ["no set bound to this agent"]
  if (resolution === undefined) {
    const reachableElsewhere = entry !== undefined && sets.resolve({ agent: agentId, tool: entry.tool }) !== undefined
    return [reachableElsewhere && entry !== undefined
      ? `${entry.serverId} is in no set bound to this agent`
      : "no bound set has a reachable server"]
  }
  if (resolution.refusedBy === undefined || entry === undefined) return []
  return [resolution.refusedBy === "deny"
    ? `${resolution.setId} explicitly denies ${entry.tool}`
    : `${resolution.setId} allowlist does not include ${entry.tool}`]
}
