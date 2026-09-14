import { count, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { AgentdSurfaces } from "./surfaces.ts"

const states = ["queued", "claimed", "running", "done", "failed", "cancelled"] as const

export const launchOperations = ({ control, launches }: AgentdSurfaces): readonly Operation[] => [
  operation({
    name: "agentd_launch",
    description: "Run one agent's turn in one directory; the machine it runs on is read from the agent",
    input: z.object({
      agentId: z.string().min(1), workdir: z.string().min(1), prompt: z.string(),
      nodeId: z.string().min(1).optional(),
    }).strict(),
    http: { method: "POST", path: "/agentd/launch", status: 201 },
    handler: (input) => {
      const agent = control.desired(input.agentId).agent
      return { ok: true, launch: launches.enqueue({ ...input, machineId: agent.machineId, kind: agent.kind }) }
    },
  }),
  operation({
    name: "agentd_launches",
    description: "Queued and finished work, optionally for one machine or for one task node", access: "read",
    input: z.object({ machineId: z.string().min(1).optional(), nodeId: z.string().min(1).optional() }).strict(),
    http: { method: "GET", path: "/agentd/launch" },
    handler: (input) => ({ ok: true, launches: launches.list(input) }),
  }),
  operation({
    name: "agentd_launch_poll", description: "Claim work for this machine; claiming is what makes an intent its own",
    input: z.object({ machineId: z.string().min(1), limit: count.min(1).max(16).optional() }).strict(),
    http: { method: "POST", path: "/agentd/launch/poll" },
    handler: (input) => ({ ok: true, launches: launches.poll(input.machineId, input.limit) }),
  }),
  operation({
    name: "agentd_launch_report", description: "What became of an intent; only the machine holding it may say",
    input: z.object({
      intentId: z.string().min(1), machineId: z.string().min(1), state: z.enum(states), detail: z.string().optional(),
    }).strict(),
    http: { method: "POST", path: "/agentd/launch/report" },
    handler: (input) => ({ ok: true, launch: launches.report(input.intentId, input.machineId, input.state, input.detail) }),
  }),
]
