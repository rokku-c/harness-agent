/**
 * Shared driver run skeleton (B8): runToCompletion factorizes the run-loop
 * contract every composed driver repeats: requireUntil first, materialize the
 * request, delegate the full execution to the driver's generate (the tool
 * loop lives INSIDE generate - the helper does not unify the four tool-loop
 * variants native/ops/MCP/fail-early), then report usage exactly once on
 * success and dispatch on Until. This is NOT a user-facing API: driver
 * authors import it from this module (src/core stays the contract home).
 */
import { Effect } from "effect"
import {
  AgentFailure,
  commitSchemaResult,
  decode,
  materialize,
  report,
  requireUntil,
  type AgentError,
  type Capabilities,
  type RunRequest,
  type UsageReport
} from "./core.js"

/**
 * The driver's complete execution result. raw is the value the Until
 * dispatch consumes: text for Text/Stop, the already-parsed value for Schema
 * (the driver JSON.parse/Output.object-decodes before returning). reasoning
 * and toolCall cover the Thinking/ToolCall paths; usage is reported by the
 * helper exactly once on success (a failing usage hook never kills the run).
 */
export interface DriverGenerate {
  readonly raw: unknown
  readonly reasoningText?: string
  readonly toolCall?: { readonly id: string; readonly name: string; readonly input: unknown }
  readonly usage?: UsageReport
}

/**
 * The generate contract: 'the driver's complete execution'. The tool loop
 * (native/ops/MCP/fail-early variants) stays inside generate; the helper only
 * owns the shared skeleton around it.
 */
export interface GenerateContract<A, R, RD> {
  readonly id: string
  readonly capabilities: Capabilities
  readonly generate: (request: RunRequest<A, R>) => Effect.Effect<DriverGenerate, AgentError, R | RD>
}

export const runToCompletion = <A, R, RD>(
  request: RunRequest<A, R>,
  contract: GenerateContract<A, R, RD>
): Effect.Effect<A, AgentError, R | RD> => Effect.gen(function*() {
  yield* requireUntil(contract.id, contract.capabilities, request.until)
  const materialized = yield* materialize(request)
  const generated = yield* contract.generate(materialized)
  // usage is reported exactly once, only on success; catchAllCause (not
  // Effect.ignore, which only swallows the E layer) so even a defective usage
  // hook never kills the run.
  if (generated.usage !== undefined) {
    yield* report(materialized, {
      _tag: "UsageReported", agent: contract.id, usage: generated.usage
    }).pipe(Effect.catchAllCause(() => Effect.void))
  }
  switch (materialized.until._tag) {
    case "Stop":
    case "Text": return generated.raw as A
    case "Thinking": return generated.reasoningText as A
    case "ToolCall": {
      const call = generated.toolCall
      if (call === undefined)
        return yield* new AgentFailure({ agent: contract.id, cause: "No tool call produced" })
      return call as A
    }
    case "Schema": {
      const output = yield* decode(materialized.until.schema, generated.raw)
      yield* commitSchemaResult(materialized, output, contract.id)
      return output
    }
  }
})
