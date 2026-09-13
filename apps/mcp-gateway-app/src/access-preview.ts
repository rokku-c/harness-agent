import { makeRegistrySetResolver, type LiveSets, type ToolCatalog } from "@effect-agent/mcp-gateway"
import type { Registry } from "@effect-agent/mcp-registry"
import { refusalReasons } from "./access-reasons.ts"

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
/**
 * What a preview asks: the registry it draws topology from, the sets the center
 * declares — the same object the door decides with — and what the door offers.
 */
export interface AccessSurfaces {
  readonly registry: Registry
  readonly sets: LiveSets
  /** The door's own catalog, keyed by the name `tools/list` answers with. */
  readonly offered: ToolCatalog
}

/**
 * The bound sets, as the page lists them. Display only: every way of *deciding*
 * is asked of the engine below, and the one way of deciding whether a registry
 * record reaches is the resolver the engine itself uses, so a set drawn as
 * reachable is a set the engine would route through.
 */
const boundSets = ({ sets, registry }: AccessSurfaces, agentId: string): readonly AccessSet[] => {
  const resolver = makeRegistrySetResolver(registry)
  const facts = sets.facts()
  const bound = facts.bindings.find((binding) => binding.agentId === agentId)?.setIds ?? []
  return bound.flatMap((setId): AccessSet[] => {
    const set = facts.sets.find((candidate) => candidate.setId === setId)
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
 *
 * The tool is named the way the door names it: the name `tools/list` answers
 * with, looked up here rather than parsed, and the pair it stands for — the
 * server as well as the tool — is what the engine is asked about. A call names
 * both, so a preview that named only the tool could allow a server the call
 * never routes through, and the page would be read as an answer about it.
 *
 * A refusal is one fact of four, and which one is `access-reasons.ts`.
 */
export const previewAccess = (surfaces: AccessSurfaces, agentId: string, tool?: string): AccessPreview => {
  const { sets, offered } = surfaces
  const entry = tool === undefined ? undefined : offered.find(tool)
  const bound = sets.bound(agentId)
  const query = { agent: agentId, ...(entry === undefined ? {} : { serverId: entry.serverId, tool: entry.tool }) }
  const resolution = sets.resolve(query)
  // A call names a tool the door advertises, and a name it does not advertise is
  // no pair anything can be routed to. The walk below still finds a set — it was
  // asked without a tool — so the refusal has to be stated here as well, or the
  // page would call a name nothing offers "Allowed" and reach nothing on the
  // call it describes.
  const nameable = tool === undefined || entry !== undefined
  const allowed = nameable && resolution?.allowed === true
  return {
    agentId, bound, allowed, sets: boundSets(surfaces, agentId),
    reasons: allowed ? [] : refusalReasons({ sets, agentId, bound, tool, entry, resolution }),
  }
}
