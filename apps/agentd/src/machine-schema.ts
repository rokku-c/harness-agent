import { z } from "@effect-agent/effect-config"

const declaredMachine = z.object({
  machineId: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["online", "offline", "degraded"]),
  capabilities: z.array(z.string().min(1)),
  namespaces: z.array(z.string().min(1)),
  maxApps: z.number().int().nonnegative().optional(),
})
export const machine = z.object({
  ...declaredMachine.shape,
  status: declaredMachine.shape.status.default("online"),
  capabilities: declaredMachine.shape.capabilities.default([]),
  namespaces: declaredMachine.shape.namespaces.default([]),
  reportedAt: z.number().int().nonnegative().default(0),
}).strict()
export const announcedMachine = declaredMachine.strict()
