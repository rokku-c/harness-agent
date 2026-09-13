/**
 * A run is one execution binding: an agent instance holds a task node while it
 * works, and board records the binding. Board never schedules a run - it records
 * what an agent declares and refuses declarations that contradict what it has
 * already recorded.
 *
 * `kind` is an open string, not a board enum: which agents exist is agentd's
 * vocabulary, and board must not need a release to learn a new one.
 */
import { z } from "@effect-agent/effect-config"

/** how the agent reached the board: a claim over MCP, a machine probe, or the in-process runtime */
export const channels = ["mcp-self", "probe", "runtime"] as const
/** what an agent may report; `orphan` is board's own finding after a restart, never an agent's claim */
export const reportedStates = ["done", "failed"] as const
export const runStates = ["running", ...reportedStates, "orphan"] as const

/** hello/heartbeat: the identity an agent instance announces */
export const announceSchema = z.object({
  agentId: z.string().min(1), kind: z.string().min(1), channel: z.enum(channels).default("mcp-self"),
  host: z.string().min(1).optional(), capabilities: z.array(z.string().min(1)).default([]),
}).strict()
export const startRunSchema = announceSchema.extend({
  nodeId: z.string().min(1), sessionRef: z.string().min(1).optional(),
  /** Set when this run is the execution of a launch intent the machine collected. */
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
/** an announcement after parsing: defaults applied, unknown keys refused */
export type Announcement = z.infer<typeof announceSchema>
export type RunState = (typeof runStates)[number]
export type ReportedState = (typeof reportedStates)[number]
export type AnnounceInput = z.input<typeof announceSchema>
export type StartRunInput = z.input<typeof startRunSchema>
export type ProgressInput = z.input<typeof progressSchema>
export type FinishInput = z.input<typeof finishSchema>
