import type {
  AgentBinding, AgentInstance, BundleRef, DeclaredMachine, DesiredAgentConfig, DesiredNode, McpServerRef, McpSet,
  Machine, NodeAppPlacement, NodeBinding, ResolvedNodeApp,
} from "./types.ts"
import type { AgentdControl, NodeLiveness } from "./contract.ts"
import { bundleRefId } from "./bundles.ts"
import { makeBundleRegistry } from "./bundle-registry.ts"
import { nodeAppId } from "./nodes.ts"
import { same } from "./stable.ts"
import { AgentdError } from "./errors.ts"
import { makeNodePresence, sameToken, type LeaseClock, type NodePresence } from "./presence.ts"

export interface AgentdControlOptions {
  /** Both halves of the lease clock; injected so a test can age a node out (§8.5-1). */
  readonly clock?: Partial<LeaseClock>
  /** How long one node heartbeat is good for. Absent = `presence.ts`'s default. */
  readonly leaseTtlMs?: number
  /**
   * The token node liveness verbs must present. Absent = they accept anyone, and
   * {@link NodeLiveness.tokenRequired} says so out loud — an unarmed guard that
   * looked armed would be worse than no guard.
   */
  readonly nodeToken?: string
}

export const makeAgentdControl = (options: AgentdControlOptions = {}): AgentdControl => {
  const machines = new Map<string, Machine>(), agents = new Map<string, AgentInstance>()
  const servers = new Map<string, McpServerRef>(), sets = new Map<string, McpSet>(), bindings = new Map<string, AgentBinding>()
  /** Published versions and their bytes (§7.6); version identity is owned over there. */
  const registry = makeBundleRegistry()
  /**
   * A node's deployment (§8.4). The binding carries only addresses, so the
   * placements themselves live beside it — parsing `ns::id@version` back apart
   * would make the namespace grammar load-bearing for no gain.
   */
  const nodes = new Map<string, { binding: NodeBinding; kernel?: BundleRef; apps: readonly ResolvedNodeApp[] }>()
  let revision = 0
  const bump = () => ++revision
  const checkId = (id: string) => { if (!id || /\s/.test(id)) throw new AgentdError(400, "invalid id") }
  /**
   * Node liveness (§8.5-1). Kept apart from `machines` on purpose: `machines` is
   * what a node *is* (identity, capabilities — true whether or not it is running),
   * this is whether it is *up* right now. Nothing here is ever persisted, and it
   * should not be: a config file cannot know which nodes are alive, so a restored
   * lease table would be a set of claims nobody made.
   */
  const presence = makeNodePresence({
    ...(options.leaseTtlMs === undefined ? {} : { leaseTtlMs: options.leaseTtlMs }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
  })
  /**
   * One credential check for every node-facing verb (§8.5-1). The token is one
   * secret compared in one place: a second copy of this comparison is a second
   * place to get it wrong, and the failure would be silent in exactly one of them.
   */
  const authorized = (token: string | undefined): boolean =>
    options.nodeToken === undefined || (token !== undefined && sameToken(token, options.nodeToken))
  const authorizeNode = (nodeId: string, token: string | undefined): void => {
    if (!authorized(token)) throw new AgentdError(401, `unauthorized node ${nodeId}`)
  }
  /** A declared machine that has never announced is offline, not missing. */
  const presenceOf = (nodeId: string): NodePresence =>
    presence.presence(nodeId) ?? { nodeId, online: false, withdrawn: false }
  const desired = (agentId: string): DesiredAgentConfig => {
    const agent = agents.get(agentId); if (!agent) throw new AgentdError(404, "agent not found")
    const machine = machines.get(agent.machineId)
    const binding = bindings.get(agentId)
    if (!binding) return { agent, revision, sets: [], servers: [], bundles: [], ...(machine === undefined ? {} : { machine }) }
    const selected = binding.setIds.map((id) => sets.get(id)!).filter(Boolean)
    const serverIds = [...new Set(selected.flatMap((set) => set.servers))]
    return {
      agent, machine: machine!, revision: binding.revision, sets: selected,
      servers: serverIds.map((id) => servers.get(id)!).filter(Boolean),
      bundles: binding.bundleIds.map((id) => registry.get(id)!).filter(Boolean),
    }
  }
  /** The binding, created empty on first write so sets and bundles share one revision. */
  const bindingFor = (agentId: string): AgentBinding => {
    if (!agents.has(agentId)) throw new AgentdError(404, "agent not found")
    const existing = bindings.get(agentId)
    return existing ?? { agentId, setIds: [], bundleIds: [], revision: 0 }
  }
  const desiredNode = (nodeId: string): DesiredNode => {
    const node = machines.get(nodeId)
    if (node === undefined) throw new AgentdError(404, "node not found")
    const held = nodes.get(nodeId)
    if (held === undefined) return { node, revision, kernel: undefined, apps: [] }
    return { node, revision: held.binding.revision, kernel: held.kernel, apps: held.apps }
  }
  return {
    registerMachine(machine) { checkId(machine.machineId); machines.set(machine.machineId, machine); bump(); return machine },
    registerAgent(agent) { checkId(agent.agentId); if (!machines.has(agent.machineId)) throw new AgentdError(404, "machine not found"); agents.set(agent.agentId, agent); bump(); return agent },
    registerServer(server) { checkId(server.serverId); if (servers.has(server.serverId)) throw new AgentdError(409, "server already exists"); servers.set(server.serverId, server); bump(); return server },
    upsertSet(set) { checkId(set.setId); if (set.allowTools?.some((tool) => set.denyTools?.includes(tool))) throw new AgentdError(400, "allow/deny overlap"); if (set.servers.some((id) => !servers.has(id))) throw new AgentdError(404, "server not found"); sets.set(set.setId, set); bump(); return set },
    bindAgent(agentId, setIds) { if (!agents.has(agentId)) throw new AgentdError(404, "agent not found"); if (setIds.some((id) => !sets.has(id))) throw new AgentdError(404, "set not found"); const binding = { ...bindingFor(agentId), setIds, revision: bump() }; bindings.set(agentId, binding); return binding },
    publishBundle(bundle, source) { const published = registry.publish(bundle, source); bump(); return published },
    /**
     * A published version's bytes (§8.2, P6). Reads are not revisions: what a
     * node fetches does not change what it should run, so this does not bump.
     */
    artifact(id, token) {
      if (!authorized(token)) throw new AgentdError(401, "unauthorized artifact fetch")
      return registry.artifact(id)
    },
    bindBundles(agentId, bundleIds) {
      if (bundleIds.some((id) => registry.get(id) === undefined)) throw new AgentdError(404, "bundle not found")
      const binding = { ...bindingFor(agentId), bundleIds, revision: bump() }
      bindings.set(agentId, binding); return binding
    },
    desired, reportApplied(agentId, appliedRevision, state) { const current = desired(agentId); if (appliedRevision !== current.revision) throw new AgentdError(409, "stale agent revision"); return { agentId, revision: appliedRevision, state } },
    bindNode(nodeId, kernelId, apps) {
      if (!machines.has(nodeId)) throw new AgentdError(404, "node not found")
      if (kernelId !== undefined) {
        const kernel = registry.get(kernelId)
        if (kernel === undefined) throw new AgentdError(404, "bundle not found")
        // A node runs exactly one kernel; an app in the kernel slot would be a
        // category error that only surfaces at load time.
        if ((kernel.kind ?? "app") !== "kernel") throw new AgentdError(400, `${kernelId} is not a kernel artifact`)
      }
      // Resolve each placement against the registry rather than trusting the
      // placement to restate the artifact's lines: one source for what an
      // artifact runs on is what stops a placement from contradicting it.
      const resolved = apps.map((app) => {
        const id = bundleRefId(app)
        const bundle = registry.get(id)
        if (bundle === undefined) throw new AgentdError(404, `bundle not found: ${id}`)
        if ((bundle.kind ?? "app") !== "app") throw new AgentdError(400, `${id} is a kernel artifact; a node app placement must be an app`)
        return { ...bundle, ns: app.ns, ...(app.enabled === undefined ? {} : { enabled: app.enabled }) }
      })
      const addresses = resolved.map(nodeAppId)
      if (new Set(addresses).size !== addresses.length) {
        throw new AgentdError(400, "the same app is placed twice at one namespace")
      }
      const binding: NodeBinding = {
        nodeId, revision: bump(), placements: addresses,
        ...(kernelId === undefined ? {} : { kernelId }),
      }
      nodes.set(nodeId, {
        binding,
        ...(kernelId === undefined ? {} : { kernel: registry.get(kernelId)! }),
        apps: resolved,
      })
      return binding
    },
    desiredNode,
    reportNodeApplied(nodeId, appliedRevision, state) {
      const current = desiredNode(nodeId)
      if (appliedRevision !== current.revision) throw new AgentdError(409, "stale node revision")
      return { nodeId, revision: appliedRevision, state }
    },
    /**
     * A node saying "I am here" (§8.5-1). It declares who it is and what it can
     * run — the same record `registerMachine` writes, so a machine has one
     * writer, not two — and that declaration is what starts the lease.
     */
    announceNode(machine, token) {
      checkId(machine.machineId)
      authorizeNode(machine.machineId, token)
      const announced = presence.announce(machine.machineId)
      const existing = machines.get(machine.machineId)
      // `reportedAt` is stamped from the server's clock, and `DeclaredMachine`
      // has no such field for a caller to fill in — a node's being up is
      // observed here, so the node does not get to say when it was seen.
      machines.set(machine.machineId, { ...machine, reportedAt: announced.lastSeen ?? 0 })
      // Presence alone never moves the revision — a receipt is about *what to
      // run*, and a heartbeat that invalidated every in-flight receipt would be
      // a liveness mechanism that breaks the deployment it exists to protect.
      // Different *capabilities*, though, change what may be pushed here, and
      // that is a desired-state change like any other.
      if (existing === undefined || !same(existing.capabilities, machine.capabilities)) bump()
      return announced
    },
    heartbeatNode(nodeId, token) {
      authorizeNode(nodeId, token)
      const beat = presence.heartbeat(nodeId)
      if (beat === undefined) throw new AgentdError(404, "node is not present; announce first")
      const known = machines.get(nodeId)
      if (known !== undefined && beat.lastSeen !== undefined) {
        machines.set(nodeId, { ...known, reportedAt: beat.lastSeen })
      }
      return beat
    },
    /** A clean shutdown, which is not a decommission: the machine and its deployment stay. */
    withdrawNode(nodeId, token) {
      authorizeNode(nodeId, token)
      const gone = presence.withdraw(nodeId)
      if (gone === undefined) throw new AgentdError(404, "node is not present; announce first")
      return gone
    },
    nodePresence(nodeId) {
      if (!machines.has(nodeId)) throw new AgentdError(404, "node not found")
      return presenceOf(nodeId)
    },
    nodeLiveness(): NodeLiveness {
      return {
        tokenRequired: options.nodeToken !== undefined,
        nodes: [...machines.keys()].map(presenceOf),
      }
    },
    status: () => ({ machines: [...machines.values()], agents: [...agents.values()], servers: [...servers.values()], sets: [...sets.values()], bundles: registry.list(), artifactIds: registry.artifactIds(), bindings: [...bindings.values()], nodes: [...nodes.values()].map((held) => held.binding), revision }),
  }
}
