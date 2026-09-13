/**
 * The agent-side push surface: what this agent should run, why it cannot, and
 * the receipt for what it did run. A node is the same three verbs at a larger
 * unit, in `node-ops`.
 */
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import { bundlePlan } from "./plan.ts"
import type { AgentdSurfaces } from "./surfaces.ts"

const revision = z.object({
  revision: z.number().int().nonnegative(), state: z.unknown().optional(),
}).strict()

export const agentOperations = ({ control, applied, status }: AgentdSurfaces): readonly Operation[] => [
  operation({
    name: "agentd_status", description: "What the control plane believes: machines, agents, deployments, receipts and liveness",
    access: "read", input: noInput, http: { method: "GET", path: "/agentd" },
    handler: () => ({ app: "agentd", ...(status() as Record<string, unknown>) }),
  }),
  operation({
    name: "agentd_desired", description: "The desired state of one agent", access: "read",
    input: z.object({ agentId: z.string().min(1) }).strict(), http: { method: "GET", path: "/agentd/desired" },
    handler: (input) => ({ ok: true, desired: control.desired(input.agentId) }),
  }),
  operation({
    name: "agentd_plan_bundles", description: "The artifact plan for one agent, and the place a push is refused",
    access: "read", input: z.object({ agentId: z.string().min(1), reported: z.unknown().optional() }).strict(),
    http: { method: "GET", path: "/agentd/plan" },
    handler: (input) => ({ ok: true, ...bundlePlan(control, input.agentId, input.reported) }),
  }),
  operation({
    name: "agentd_report_applied", description: "An agent's receipt for a revision it applied",
    input: revision.extend({ agentId: z.string().min(1) }).strict(), http: { method: "POST", path: "/agentd/report" },
    handler: (input) => {
      const report = control.reportApplied(input.agentId, input.revision, input.state)
      applied.set(input.agentId, { ...report, at: Date.now() })
      return { ok: true, report }
    },
  }),
]
