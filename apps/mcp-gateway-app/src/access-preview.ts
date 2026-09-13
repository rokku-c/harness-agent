import { makeRegistrySetResolver, type McpSet, type McpSetBinding, type McpSetRegistry } from "@effect-agent/mcp-gateway"
import type { Registry } from "@effect-agent/mcp-registry"

export interface AccessSet {
  readonly setId: string
  readonly name: string
  readonly servers: ReadonlyArray<{ readonly serverId: string; readonly status: string; readonly reachable: boolean }>
  readonly allowTools: readonly string[] | null
  readonly denyTools: readonly string[]
}
export interface AccessPreview {
  readonly agentId: string
  readonly bound: boolean
  readonly sets: readonly AccessSet[]
  readonly allowed: boolean
  readonly reasons: readonly string[]
}
/** The gateway's own two declarations, not a second copy of their shape. */
export interface AccessConfig {
  readonly sets: readonly McpSet[]
  readonly bindings: readonly McpSetBinding[]
}
/** What a preview asks: the config it explains, the registry it draws, and the engine that decides. */
export interface AccessSurfaces {
  readonly config: AccessConfig
  readonly registry: Registry
  readonly sets: McpSetRegistry
}

/**
 * The bound sets, as the page lists them. Display only: every way of *deciding*
 * is asked of the engine below, and the one way of deciding whether a registry
 * record reaches is the resolver the engine itself uses, so a set drawn as
 * reachable is a set the engine would route through.
 */
const boundSets = ({ config, registry }: AccessSurfaces, agentId: string): readonly AccessSet[] => {
  const resolver = makeRegistrySetResolver(registry)
  const bound = config.bindings.find((binding) => binding.agentId === agentId)?.setIds ?? []
  return bound.flatMap((setId): AccessSet[] => {
    const set = config.sets.find((candidate) => candidate.setId === setId)
    if (set === undefined) return []
    return [{
      setId, name: set.name,
      servers: set.servers.map((serverId) => ({
        serverId, status: registry.get(serverId)?.status ?? "unknown",
        reachable: resolver.resolve(serverId) !== undefined,
      })),
      allowTools: set.allowTools ?? null, denyTools: set.denyTools ?? [],
    }]
  })
}

/**
 * What the gateway would do with one agent's call to one tool, read off the
 * gateway's own registry: `resolve` for the verdict — asked with a tool or
 * without one, which is the same walk — and `bound` for the reason a refusal
 * can name. Nothing here walks a set, reads an allow-list, or decides anything
 * — the file that did that decided differently from the gateway it was
 * previewing, which is worse than having no preview at all: the page is read as
 * the answer, and the call it describes then fails somewhere else.
 */
export const previewAccess = (surfaces: AccessSurfaces, agentId: string, tool?: string): AccessPreview => {
  const { sets } = surfaces
  const isBound = sets.bound(agentId)
  const resolution = sets.resolve({ agent: agentId, ...(tool === undefined ? {} : { tool }) })
  const allowed = resolution?.allowed === true
  const reasons: string[] = []
  if (!allowed) {
    if (!isBound) reasons.push("no set bound to this agent")
    else if (resolution === undefined) reasons.push("no bound set has a reachable server")
    else if (resolution.refusedBy !== undefined) {
      reasons.push(resolution.refusedBy === "deny"
        ? `${resolution.setId} explicitly denies ${tool}`
        : `${resolution.setId} allowlist does not include ${tool}`)
    }
  }
  return { agentId, bound: isBound, sets: boundSets(surfaces, agentId), allowed, reasons }
}
