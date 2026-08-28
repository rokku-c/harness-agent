import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import { AgentContext, CodexAgent, Until, type DriverEvent, type UsageReport } from "../src/index.js"

/**
 * Behavior matrix (B8 migration gate): pins codex driver behavior across
 * Until x success/failure x usage-exactly-once so the runToCompletion
 * migration can be verified as a mechanical cut - the matrix runs before and
 * after the migration and any difference is a migration bug, not a drift.
 */

const reportedEvents = () => {
  const reported: DriverEvent[] = []
  return {
    reported,
    report: (event: DriverEvent) => Effect.sync(() => reported.push(event))
  }
}

const usageEvents = (reported: DriverEvent[]) =>
  reported.filter((e): e is Extract<DriverEvent, { _tag: "UsageReported" }> => e._tag === "UsageReported")

describe("codex behavior matrix (B8 migration gate)", () => {
  test("Until.text success: usage reported exactly once", async () => {
    const client = {
      startThread: () => ({
        run: async () => ({ items: [], finalResponse: "ok", usage: { input_tokens: 7, output_tokens: 3 } })
      })
    } as any
    const driver = CodexAgent.make({ client })
    const { reported, report } = reportedEvents()
    const output = await Effect.runPromise(driver.run({
      context: AgentContext.text("x"), until: Until.stop, access: [], report
    }))
    expect(output).toBe("ok")
    const usages = usageEvents(reported)
    expect(usages).toHaveLength(1)
    expect(usages[0]?.usage).toEqual({ inputTokens: 7, outputTokens: 3, model: null })
  })

  test("thread.run rejection: no usage reported (the turn never happened)", async () => {
    const client = {
      startThread: () => ({ run: async () => { throw new Error("down") } })
    } as any
    const driver = CodexAgent.make({ client })
    const { reported, report } = reportedEvents()
    const failure = await Effect.runPromise(Effect.flip(driver.run({
      context: AgentContext.text("x"), until: Until.stop, access: [], report
    })))
    expect((failure as { _tag?: string })._tag).toBe("AgentFailure")
    expect(usageEvents(reported)).toHaveLength(0)
  })

  test("Until.schema with non-JSON response: the run fails AND usage is still reported (tokens were spent)", async () => {
    const client = {
      startThread: () => ({
        run: async () => ({ items: [], finalResponse: "not json", usage: { input_tokens: 5, output_tokens: 1 } })
      })
    } as any
    const driver = CodexAgent.make({ client })
    const { reported, report } = reportedEvents()
    const failure = await Effect.runPromise(Effect.flip(driver.run({
      context: AgentContext.text("x"),
      until: Until.schema(Schema.Struct({ ok: Schema.Boolean })),
      access: [],
      report
    })))
    expect((failure as { cause?: unknown }).cause).toBeInstanceOf(SyntaxError)
    // the report precedes the Schema post-processing: a parse-failed turn
    // still reports the tokens it spent
    const usages = usageEvents(reported)
    expect(usages).toHaveLength(1)
    expect(usages[0]?.usage).toEqual({ inputTokens: 5, outputTokens: 1, model: null })
  })

  test("Until.schema with schema-invalid JSON: usage reported once, failure attributed to schema", async () => {
    const client = {
      startThread: () => ({
        run: async () => ({ items: [], finalResponse: "{\"ok\": \"yes\"}", usage: { input_tokens: 2, output_tokens: 2 } })
      })
    } as any
    const driver = CodexAgent.make({ client })
    const { reported, report } = reportedEvents()
    const failure = await Effect.runPromise(Effect.flip(driver.run({
      context: AgentContext.text("x"),
      until: Until.schema(Schema.Struct({ ok: Schema.Boolean })),
      access: [],
      report
    })))
    expect((failure as { agent?: string }).agent).toBe("schema")
    expect(usageEvents(reported)).toHaveLength(1)
  })

  test("Until.schema success: usage exactly once and the decoded value is returned", async () => {
    const client = {
      startThread: () => ({
        run: async () => ({ items: [], finalResponse: "{\"ok\": true}", usage: { input_tokens: 4, output_tokens: 4 } })
      })
    } as any
    const driver = CodexAgent.make({ client })
    const { reported, report } = reportedEvents()
    const output = await Effect.runPromise(driver.run({
      context: AgentContext.text("x"),
      until: Until.schema(Schema.Struct({ ok: Schema.Boolean })),
      access: [],
      report
    }))
    expect(output).toEqual({ ok: true })
    expect(usageEvents(reported)).toHaveLength(1)
  })

  test("a failing usage hook never kills the run (catchAllCause)", async () => {
    const client = {
      startThread: () => ({
        run: async () => ({ items: [], finalResponse: "ok", usage: { input_tokens: 1, output_tokens: 1 } })
      })
    } as any
    const driver = CodexAgent.make({ client })
    const output = await Effect.runPromise(driver.run({
      context: AgentContext.text("x"),
      until: Until.stop,
      access: [],
      report: () => Effect.die("defective usage hook")
    }))
    expect(output).toBe("ok")
  })
})
