import { z, type ConfigDeclaration } from "@effect-agent/effect-config"
import { mcpSetBindingSchema as binding, mcpSetSchema as set } from "@effect-agent/mcp-gateway"
import { bundle } from "./bundle-schema.ts"
import { machine } from "./machine-schema.ts"

const agent = z.object({
  agentId: z.string().min(1), machineId: z.string().min(1),
  kind: z.string().min(1), version: z.string().min(1),
  status: z.enum(["online", "offline", "degraded"]).default("offline"),
}).strict()
const server = z.object({
  serverId: z.string().min(1), endpoint: z.string().min(1),
  transport: z.enum(["stdio", "streamable-http"]), authRef: z.string().min(1).optional(),
}).strict()
/** Artifacts an agent should run, named `bundleId@version` so versions coexist. */
const bundleBinding = z.object({ agentId: z.string().min(1), bundleIds: z.array(z.string().min(1)) }).strict()
/**
 * One app instance on a node (§8.4): *where* an artifact sits, not *what* it is.
 * A placement names an artifact that was published above; it deliberately does
 * not restate `abi`/`runtimes`, because a placement that could contradict the
 * artifact it places would make the artifact's own declaration unenforceable.
 * The same artifact may appear twice at different namespaces — that is §8.1.
 */
const nodeApp = z.object({
  bundleId: z.string().min(1), version: z.string().min(1),
  ns: z.string().min(1), enabled: z.boolean().optional(),
}).strict()
/** A node's whole deployment: one kernel and a set of placed apps. */
const nodeBinding = z.object({
  nodeId: z.string().min(1),
  kernelId: z.string().min(1).optional(),
  apps: z.array(nodeApp).default([]),
}).strict()
/**
 * What one agent presents at the MCP Gateway's door (§F10), declared against the
 * agent's id — the key the door resolves it to and binds by. Plaintext lives here
 * for the same reason `nodeToken` does: the center is what writes agent configs,
 * and a credential is plaintext wherever it is used.
 */
const credential = z.object({ agentId: z.string().min(1), token: z.string().min(1) }).strict()
const schema = z.object({
  machines: z.array(machine).default([]),
  agents: z.array(agent).default([]),
  credentials: z.array(credential).default([]),
  servers: z.array(server).default([]),
  sets: z.array(set).default([]),
  bindings: z.array(binding).default([]),
  bundles: z.array(bundle).default([]),
  bundleBindings: z.array(bundleBinding).default([]),
  nodeBindings: z.array(nodeBinding).default([]),
  /**
   * The shared secret a node presents to announce, heartbeat and withdraw
   * (§8.5-1). One token for the fleet, as `apps/agentd/README.md` describes for the
   * probe. Absent = those verbs accept anyone, and `nodeLiveness().tokenRequired`
   * says so — so an unarmed guard cannot pass for an armed one.
   */
  nodeToken: z.string().min(1).optional(),
  /** Local addresses this machine's agents reach, and where each really goes (§5, `/agentd/tunnel`). */
  tunnel: z.array(z.object({ name: z.string().min(1), url: z.string().min(1) }).strict()).default([]),
  /**
   * How long one node heartbeat is good for (§8.5-1). Absent = the presence
   * table's own default. This is fleet policy rather than a constant: a machine on
   * a flaky link and one on a lab switch want different answers, and the operator
   * is the one who knows which they have. It is also what makes the lease
   * observable — a TTL that cannot be set is a lease nobody can watch expire.
   */
  leaseTtlMs: z.number().int().positive().optional(),
  /**
   * Where the agents this center configures reach the MCP Gateway (§F10). Absent =
   * they cannot be told, and the fetch says so rather than planning a config with
   * no door in it. The address is not validated here: the adapter one layer down
   * decides what a door may be, and two rules for one question is what lets a
   * config that saves be a config that cannot be planned.
   */
  gateway: z.string().min(1).optional(),
}).strict()

export const effectConfig: ConfigDeclaration<typeof schema> = {
  appId: "agentd", title: "agentd", description: "Machine and agent configuration center", schema,
}
