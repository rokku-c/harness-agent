import { Effect } from "effect"
import type { Driver, RunRequest } from "@effect-agent/core"
import type { Model, WireMessage } from "@effect-agent/model"

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

export const reviewerDriver: Driver<never> = {
  id: "reviewer",
  capabilities: { provider: { _tag: "Configurable" }, granularity: "run", thinking: false, cancel: true, pause: true, resume: false, fork: "none", tools: "native", toolCalls: "intercept", structuredOutput: "text", sandbox: "none" },
  run: <A, R>(_request: RunRequest<A, R>) => Effect.succeed("reviewed" as A)
}
