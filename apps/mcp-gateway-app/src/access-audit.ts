import type { McpGatewayEvent, McpGatewayRecorder } from "@effect-agent/mcp-gateway"
import type { Registry } from "@effect-agent/mcp-registry"

/** Bounded per-process audit; the gateway owns decisions, the host owns retention policy. */
export interface AuditLog extends McpGatewayRecorder {
  list(): readonly McpGatewayEvent[]
}
export const makeAuditLog = (limit = 200): AuditLog => {
  const events: McpGatewayEvent[] = []
  return {
    record: (event) => {
      events.push(event)
      if (events.length > limit) events.splice(0, events.length - limit)
    },
    list: () => [...events].reverse(),
  }
}

export interface AccessSet {
  readonly setId: string
  readonly name?: string
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
export interface AccessConfig {
  readonly sets: ReadonlyArray<{ readonly setId: string; readonly name?: string; readonly servers: readonly string[]; readonly allowTools?: readonly string[]; readonly denyTools?: readonly string[] }>
  readonly bindings: ReadonlyArray<{ readonly agentId: string; readonly setIds: readonly string[] }>
}

/**
 * The same set/allow/deny semantics the gateway enforces, projected for one agent.
 *
 * "The same" is the whole of it: the gateway answers from the FIRST bound set
 * that has a resolvable server and never consults the ones behind it
 * (`mcp-gateway/src/sets.ts`), so the preview stops there too. Reading every
 * bound set instead — any set that reaches a server and allows the tool — lets
 * a deny in the set the gateway would have used be erased by a grant in a
 * later one, and the page reports Allowed for a call the gateway refuses. A
 * preview that disagrees with the thing it previews is worse than no preview.
 */
export const previewAccess = (config: AccessConfig, registry: Registry, agentId: string, tool?: string): AccessPreview => {
  const bound = config.bindings.find((binding) => binding.agentId === agentId)?.setIds ?? []
  const reasons: string[] = []
  if (!bound.length) reasons.push("no set bound to this agent")
  const sets = bound.flatMap((setId): AccessSet[] => {
    const set = config.sets.find((candidate) => candidate.setId === setId)
    if (!set) {
      // A binding outlives the set it names — the config drops the set, the
      // binding stays. Saying so is the whole job of a preview: without it the
      // answer is a bare "Denied" with nothing under it, which reads as a bug
      // in the console rather than as a hole in the configuration.
      reasons.push(`${setId} is bound to this agent but is not a configured set`)
      return []
    }
    return [{
      setId, ...(set.name === undefined ? {} : { name: set.name }),
      servers: set.servers.map((serverId) => {
        const record = registry.get(serverId)
        return { serverId, status: record?.status ?? "unknown", reachable: record !== undefined && record.status !== "offline" }
      }),
      allowTools: set.allowTools ?? null, denyTools: set.denyTools ?? [],
    }]
  })
  // the reading makeRegistrySetResolver uses: a record that exists and is not offline
  const decided = sets.find((set) => set.servers.some((server) => server.reachable))
  if (tool === undefined) {
    // "can this agent reach anything at all" — the sets page asks it as a list
    return { agentId, bound: bound.length > 0, sets, allowed: decided !== undefined, reasons }
  }
  if (decided === undefined) {
    reasons.push(bound.length === 0 ? "agent is not bound to any set" : "no bound set has a reachable server")
    return { agentId, bound: bound.length > 0, sets, allowed: false, reasons }
  }
  const allowed = (decided.allowTools === null || decided.allowTools.includes(tool))
    && !decided.denyTools.includes(tool)
  if (!allowed) {
    reasons.push(decided.denyTools.includes(tool)
      ? `${decided.setId} explicitly denies ${tool}`
      : `${decided.setId} allowlist does not include ${tool}`)
  }
  return { agentId, bound: bound.length > 0, sets, allowed, reasons }
}
