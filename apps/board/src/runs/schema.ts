import { z } from "@effect-agent/effect-config"

export const channels = ["mcp-self", "probe", "runtime"] as const
export const reportedStates = ["done", "failed"] as const
export const runStates = ["running", ...reportedStates, "orphan"] as const

export const announceSchema = z.object({
  agentId: z.string().min(1), kind: z.string().min(1), channel: z.enum(channels).default("mcp-self"),
  host: z.string().min(1).optional(), capabilities: z.array(z.string().min(1)).default([]),
}).strict()
export const startRunSchema = announceSchema.extend({
  nodeId: z.string().min(1), sessionRef: z.string().min(1).optional(),
  intentId: z.string().min(1).optional(),
}).strict()
export const progressSchema = z.object({
  runId: z.string().min(1), agentId: z.string().min(1), note: z.string().max(2000),
}).strict()
export const finishSchema = z.object({
  runId: z.string().min(1), agentId: z.string().min(1), status: z.enum(reportedStates),
  summary: z.string().default(""),
}).strict()

export const agentSchema = z.object({
  agentId: z.string(), kind: z.string(), channel: z.enum(channels), host: z.string().optional(),
  capabilities: z.array(z.string()), firstSeen: z.number(), lastSeen: z.number(),
}).strict()
export const runSchema = z.object({
  runId: z.string(), nodeId: z.string(), agentId: z.string(), kind: z.string(), channel: z.enum(channels),
  status: z.enum(runStates), startedAt: z.number(), endedAt: z.number().optional(),
  sessionRef: z.string().optional(), note: z.string().optional(), summary: z.string().optional(),
}).strict()

export type Agent = z.infer<typeof agentSchema>
export type Run = z.infer<typeof runSchema>
export type Announcement = z.infer<typeof announceSchema>
export type RunState = (typeof runStates)[number]
export type ReportedState = (typeof reportedStates)[number]
export type AnnounceInput = z.input<typeof announceSchema>
export type StartRunInput = z.input<typeof startRunSchema>
export type ProgressInput = z.input<typeof progressSchema>
export type FinishInput = z.input<typeof finishSchema>
