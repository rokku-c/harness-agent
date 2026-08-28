/**
 * A custom driver in ~40 lines (B8): the driver author owns only the
 * generate contract (the runtime-specific execution - here a fake model
 * call); the shared skeleton (runToCompletion) owns the run-loop frame:
 * capability negotiation, access materialization, usage exactly-once
 * reporting, and the Until dispatch with uniform Schema decode + commit.
 *
 * IR: a plain Driver object whose run delegates to the skeleton; consumers
 * reach it through Agent.define(...).returns(Until.schema(...))
 * .implementedBy(driver) as with any driver.
 */
import { Effect, Schema } from "effect"
import { AgentContext, Until, type Driver, type DriverEvent, type RunRequest, type UsageReport } from "../src/index.js"
import { runToCompletion } from "../src/driver.js"

// The driver-author surface: id + capabilities + generate (the complete
// execution - a real driver would put its tool loop here; this fake just
// returns a canned answer and reports what it spent).
const capabilities = {
  provider: { _tag: "Fixed", api: "example.echo" }, granularity: "turn", thinking: false,
  cancel: false, pause: false, resume: false, fork: "none",
  tools: "none", toolCalls: "none", structuredOutput: "native", sandbox: "none"
} as const

const makeEchoDriver = (answer: unknown, spent: { input: number; output: number } | null): Driver => ({
  id: "echo",
  capabilities,
  run: <A, R>(request: RunRequest<A, R>) => runToCompletion(request, {
    id: "echo",
    capabilities,
    generate: (materialized) =>
      Effect.succeed({
        // Until dispatch consumes raw: the text for Text/Stop, the parsed
        // value for Schema (the skeleton decodes + commits uniformly)
        raw: materialized.until._tag === "Schema" ? answer : String(answer),
        // usage exactly-once on success, reported by the skeleton; a null
        // surface is expressed by omitting the field (never forced)
        ...(spent === null ? {} : {
          usage: {
            inputTokens: spent.input,
            outputTokens: spent.output,
            model: "example-echo"
          } satisfies UsageReport
        })
      })
  })
})

const driver = makeEchoDriver({ ok: true }, { input: 3, output: 1 })
const reported: DriverEvent[] = []

// Driver-author test surface: run the driver directly with a report sink.
const output = await Effect.runPromise(driver.run({
  // mechanical fixture (driver-author test surface), not definition prose
  context: AgentContext.raw("is the skeleton in charge?"),
  until: Until.schema(Schema.Struct({ ok: Schema.Boolean })),
  access: [],
  report: (event) => Effect.sync(() => reported.push(event))
}))

console.log("structured output:", output)                          // { ok: true }
console.log(
  "usage reported:",
  reported.filter((event) => event._tag === "UsageReported").length
)                                                                  // 1 - exactly once, on success
