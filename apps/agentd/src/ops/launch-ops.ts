/**
 * The launch surface. A machine asks for work rather than being told to do it,
 * so polling is a POST: it hands out intents and they stop being anyone else's,
 * and a GET that quietly claimed work would be a lie about what it does.
 */
import { count, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { AgentdSurfaces } from "./surfaces.ts"

const states = ["queued", "claimed", "running", "done", "failed", "cancelled"] as const

export const launchOperations = ({ launches }: AgentdSurfaces): readonly Operation[] => [
  operation({
    name: "agentd_launch", description: "Queue work for one machine in one directory; it waits until that machine asks",
    input: z.object({
      nodeId: z.string().min(1), machineId: z.string().min(1), kind: z.string().min(1),
      workdir: z.string().min(1), prompt: z.string(),
      // an explicit command is what makes work that is not an agent turn — an
      // install, say — expressible without inventing a second execution path
      command: z.string().min(1).optional(), args: z.array(z.string()).optional(),
    }).strict(),
    http: { method: "POST", path: "/agentd/launch", status: 201 },
    handler: (input) => ({ ok: true, launch: launches.enqueue(input) }),
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
