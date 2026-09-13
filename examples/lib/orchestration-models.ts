/**
 * The scripted cast for 05-orchestration.ts.
 *
 * Models and drivers stand in for real providers so the example can show the
 * orchestration algebra without a network. 06-live-orchestration.ts swaps
 * these for real ones and keeps the same agent definitions.
 */
import { Effect } from "effect"
import type { Driver, RunRequest } from "@effect-agent/core"
import type { Model, WireMessage } from "@effect-agent/builtin"

// a worker: reports progress, posts one finding, finishes
export const workerModel = (finding: string): Model => {
  let calls = 0
  return {
    generate: (_s: string, _m: ReadonlyArray<WireMessage>) => {
      calls++
      if (calls === 1) return Effect.succeed({ text: "", toolCalls: [{ id: "p", name: "report_progress", input: { text: "working on " + finding } }] })
      if (calls === 2) return Effect.succeed({ text: "", toolCalls: [{ id: "b", name: "post_board", input: { board: "ea://board/findings", text: finding } }] })
      return Effect.succeed({ text: "done: " + finding, toolCalls: [] })
    }
  }
}

// a batch worker: stateless - it knows its round from the thread (a tool
// result means it already posted). The supervisor fans it out with
// map_children over a task list, bounded concurrency.
export const scannerModel = (): Model => ({
  generate: (_s: string, messages: ReadonlyArray<WireMessage>) => {
    const alreadyPosted = messages.some((m) => m.role === "tool")
    if (alreadyPosted) return Effect.succeed({ text: "scan done", toolCalls: [] })
    const task = messages.find((m) => m.role === "user")?.content ?? "unknown"
    return Effect.succeed({
      text: "",
      toolCalls: [{ id: "b", name: "post_board", input: { board: "ea://board/findings", text: "scanned: " + task } }]
    })
  }
})

// the reviewer is forked by a watch rule, so it only has to answer
export const reviewerDriver: Driver<never> = {
  id: "reviewer",
  capabilities: { provider: { _tag: "Configurable" }, granularity: "run", thinking: false, cancel: true, pause: true, resume: false, fork: "none", tools: "native", toolCalls: "intercept", structuredOutput: "text", sandbox: "none" },
  run: <A, R>(_request: RunRequest<A, R>) => Effect.succeed("reviewed" as A)
}
