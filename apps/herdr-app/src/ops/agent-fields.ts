/**
 * The words Herdr's agent and pane methods are addressed and answered with.
 *
 * Shared by the two halves of the agent plane rather than restated in each: an
 * agent is targeted the same way whether it is being prompted or read, and the
 * lifecycle a wait condition names is the same set a list reports.
 */
import { z } from "@effect-agent/effect-config"

/** An agent is addressed by its live name or by the pane currently holding it. */
export const target = z.string().min(1)

/** Herdr's read sources: what is on screen, or what scrolled past it. */
export const readSource = z.enum(["visible", "recent", "recent_unwrapped", "detection"])

/** Herdr's lifecycle words, for a caller that waits for one of them specifically. */
export const agentStatus = z.enum(["idle", "working", "blocked", "done", "unknown"])

/**
 * Herdr's live-agent name rule. Said out loud, because zod's own word for a
 * failed regex is "Invalid" and the operator needs the rule, not the verdict.
 */
export const liveName = z.string().regex(/^[a-z][a-z0-9_-]{0,31}$/,
  "a name starts with a lowercase letter and holds only lowercase letters, digits, _ or - (at most 32)")

/** A duration any method may take, bounded by what Herdr itself will hold open. */
export const withinMs = z.number().int().positive().max(600_000)
