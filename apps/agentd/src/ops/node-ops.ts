import { OperationFault, json, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { announcedMachine } from "../machine-schema.ts"
import { nodePlan } from "./plan.ts"
import type { AgentdSurfaces } from "./surfaces.ts"

export const NODE_CREDENTIAL = { field: "token", header: "authorization", prefix: "Bearer " } as const
const liveness = z.object({
  nodeId: z.string().min(1), token: z.string().optional(), at: z.unknown().optional(),
}).strict()
const announce = liveness.omit({ nodeId: true }).extend({ machine: announcedMachine }).strict()

const timed = <T extends { at?: unknown }>(input: T): T => {
  if ("at" in input) throw new OperationFault(400, "liveness time is set by the server")
  return input
}
const lease = <T extends { nodeId: string; token?: string; at?: unknown }, R>(run: (nodeId: string, token?: string) => R) =>
  (input: T): unknown => {
    timed(input)
    const value = input as { nodeId: string; token?: string }
    return { ok: true, presence: run(value.nodeId, value.token) }
  }

export const nodeOperations = ({ control, nodeApplied }: AgentdSurfaces): readonly Operation[] => [
  operation({
    name: "agentd_announce_node", description: "A node declaring what it is and what it can run; the server timestamps it",
    input: announce, http: { method: "POST", path: "/agentd/node/announce", credential: NODE_CREDENTIAL },
    handler: (input) => {
      timed(input)
      return { ok: true, presence: control.announceNode(input.machine, input.token) }
    },
  }),
  operation({
    name: "agentd_heartbeat_node", description: "A node renewing its lease; the server records when it was seen",
    input: liveness, http: { method: "POST", path: "/agentd/node/heartbeat", credential: NODE_CREDENTIAL },
    handler: lease(control.heartbeatNode.bind(control)),
  }),
  operation({
    name: "agentd_withdraw_node", description: "A node leaving on its own terms, so it is not shown as up until its lease lapses",
    input: liveness, http: { method: "POST", path: "/agentd/node/withdraw", credential: NODE_CREDENTIAL },
    handler: lease(control.withdrawNode.bind(control)),
  }),
  operation({
    name: "agentd_node_presence", description: "Which nodes are up: one node's presence, or every node's",
    access: "read", input: z.object({ nodeId: z.string().min(1).optional() }).strict(),
    http: { method: "GET", path: "/agentd/node/presence" },
    handler: (input) => input.nodeId === undefined
      ? { ok: true, ...control.nodeLiveness() }
      : { ok: true, presence: control.nodePresence(input.nodeId) },
  }),
  operation({ name: "agentd_desired_node", description: "What this node should be running", access: "read", input: liveness,
    http: { method: "GET", path: "/agentd/node" }, handler: (input) => ({ ok: true, desired: control.desiredNode(input.nodeId) }) }),
  operation({
    name: "agentd_plan_node", description: "The node plan: where a whole deployment is adjudicated, artifact by artifact",
    access: "read", input: liveness.extend({ reported: json(z.unknown()).optional() }).strict(),
    http: { method: "GET", path: "/agentd/node/plan" },
    handler: (input) => ({ ok: true, ...nodePlan(control, input.nodeId, input.reported) }),
  }),
  operation({
    name: "agentd_report_node_applied", description: "A node's receipt for a revision it applied",
    input: z.object({ nodeId: z.string().min(1), revision: z.number().int().nonnegative(), state: z.unknown().optional() }).strict(),
    http: { method: "POST", path: "/agentd/node/report" },
    handler: (input) => {
      const report = control.reportNodeApplied(input.nodeId, input.revision, input.state)
      nodeApplied.set(input.nodeId, { ...report, at: Date.now() })
      return { ok: true, report }
    },
  }),
  operation({
    name: "agentd_artifact", description: "Fetch a published version's bytes", access: "read",
    input: z.object({ id: z.string().min(1), token: z.string().optional() }).strict(),
    http: { method: "GET", path: "/agentd/artifact", credential: NODE_CREDENTIAL },
    handler: (input) => ({ ok: true, artifact: control.artifact(input.id, input.token) }),
  }),
]
