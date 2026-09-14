import { AgentContext, type Content } from "@effect-agent/core"
import type { WireMessage } from "@effect-agent/model"
import type { RunBox } from "./types.ts"

export interface RunCheckpoint {
  readonly context: ReadonlyArray<Content>
  readonly thread: ReadonlyArray<WireMessage>
  readonly step: number
  readonly usedTools: ReadonlyArray<string>
  readonly retries: number
}

export const snapshotOf = (box: RunBox, step: number): RunCheckpoint => ({
  context: [...box.context.entries],
  thread: [...box.thread],
  step,
  usedTools: [...box.usedTools],
  retries: box.retries
})

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
