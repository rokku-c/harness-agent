/**
 * loop/snapshot.ts - WHAT A RUN CARRIES ACROSS A RESUME.
 *
 * Concept: one type for both directions. The write and the read each spelled
 * the shape out for themselves, so the read restored three of the box's five
 * fields and the other two - the tools the run had used, and the decode budget
 * it had spent - came back as their starting values. `planTools` then re-planned
 * a surface for an agent that had already grown one, and a run that had spent
 * its structured-result retries got them all back.
 *
 * `lastToolError` is deliberately not carried. A resume injects a recovery note
 * in its place (checkpoint.ts), and reflecting on a tool error from before the
 * checkpoint means reflecting on a world that note has just said may have
 * changed.
 */
import { AgentContext, type Content } from "@effect-agent/core"
import type { WireMessage } from "../wire.ts"
import type { RunBox } from "./types.ts"

/** what one run writes into its checkpoint, and reads back on resume */
export interface RunCheckpoint {
  readonly context: ReadonlyArray<Content>
  readonly thread: ReadonlyArray<WireMessage>
  readonly step: number
  readonly usedTools: ReadonlyArray<string>
  readonly retries: number
}

/** the box as a checkpoint. Copies: the run keeps mutating what it wrote from. */
export const snapshotOf = (box: RunBox, step: number): RunCheckpoint => ({
  context: [...box.context.entries],
  thread: [...box.thread],
  step,
  usedTools: [...box.usedTools],
  retries: box.retries
})

/**
 * Restore a checkpoint into a fresh box, and answer the step to continue from.
 *
 * A payload that is not a checkpoint is refused rather than half-read: it comes
 * from a store the operator controls, and guessing at its shape would resume a
 * run with state that never existed. The caller appends the recovery note.
 */
export const restoreInto = (box: RunBox, saved: RunCheckpoint): number => {
  if (!Array.isArray(saved.context) || !Array.isArray(saved.thread) || !Array.isArray(saved.usedTools)
    || typeof saved.step !== "number" || typeof saved.retries !== "number") {
    throw new Error("checkpoint payload is not a run snapshot: rebuild the checkpoint rather than resuming it")
  }
  box.context = new AgentContext(saved.context)
  box.thread.length = 0
  box.thread.push(...saved.thread)
  box.usedTools = [...saved.usedTools]
  box.retries = saved.retries
  return saved.step
}
