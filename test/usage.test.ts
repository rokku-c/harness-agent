import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { MockLanguageModelV4 } from "ai/test"
import {
  AgentContext,
  CodexAgent,
  Harness,
  Until,
  VercelAgent,
  type DriverEvent,
  type UsageReport
} from "../src/index.js"

const usage = {
  inputTokens: { total: 5, noCache: 5, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 3, text: 3, reasoning: undefined }
}

const usage0 = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined }
}

const toolCallResult = {
  content: [{ type: "tool-call" as const, toolCallId: "call-1", toolName: "t", input: JSON.stringify({}) }],
  finishReason: { unified: "tool-calls" as const, raw: undefined },
  usage,
  warnings: []
}
// Second step carries zero usage so the aggregated report stays 5/3 (the ai SDK
// sums usage across steps, verified by probe).
const zeroUsage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined }
}

const textResult = {
  content: [{ type: "text" as const, text: "ok" }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage: zeroUsage,
  warnings: []
}

describe("usage metering (B4)", () => {
  test("vercel reports flat aggregated usage between RunStarted and RunCompleted", async () => {
    const model = new MockLanguageModelV4({ doGenerate: [toolCallResult, textResult] })
    const events: Array<{ tag: string; usage?: UsageReport }> = []
    const hook = Harness.hook("capture", (event) => Effect.sync(() => {
      events.push(event._tag === "UsageReported" ? { tag: event._tag, usage: event.usage } : { tag: event._tag })
    }))
    const output = await Effect.runPromise(Harness.withHooks(VercelAgent.make({ model }), hook).run({
      context: AgentContext.raw("x"), until: Until.stop, access: []
    }))
    expect(output).toBe("ok")
    // Two model steps: the tool call runs through the tool pipeline and the
    // text step finishes; usage is reported once for the aggregated turn.
    expect(model.doGenerateCalls.length).toBe(2)
    const tags = events.map((e) => e.tag)
    expect(tags).toContain("UsageReported")
    expect(tags.indexOf("UsageReported")).toBeGreaterThan(tags.indexOf("RunStarted"))
    expect(tags.indexOf("UsageReported")).toBeLessThan(tags.indexOf("RunCompleted"))
    const usageEvent = events.find((e) => e.tag === "UsageReported")
    expect(usageEvent?.usage).toEqual({ inputTokens: 5, outputTokens: 3, model: "mock-model-id" })
  })

  test("codex maps snake_case turn usage into UsageReported", async () => {
    const client = {
      startThread: () => ({
        run: async () => ({ items: [], finalResponse: "ok", usage: { input_tokens: 10, output_tokens: 2 } })
      })
    } as any
    const driver = CodexAgent.make({ client })
    const reported: DriverEvent[] = []
    await Effect.runPromise(driver.run({
      context: AgentContext.raw("x"), until: Until.stop, access: [],
      report: (event) => Effect.sync(() => reported.push(event))
    }))
    const usageEvent = reported.find((e) => e._tag === "UsageReported") as { usage: UsageReport } | undefined
    expect(usageEvent?.usage).toEqual({ inputTokens: 10, outputTokens: 2, model: null })
  })

  test("codex reports null usage honestly instead of skipping", async () => {
    const client = {
      startThread: () => ({
        run: async () => ({ items: [], finalResponse: "ok", usage: null })
      })
    } as any
    const driver = CodexAgent.make({ client })
    const reported: DriverEvent[] = []
    await Effect.runPromise(driver.run({
      context: AgentContext.raw("x"), until: Until.stop, access: [],
      report: (event) => Effect.sync(() => reported.push(event))
    }))
    const usageEvent = reported.find((e) => e._tag === "UsageReported") as { usage: UsageReport } | undefined
    expect(usageEvent?.usage).toEqual({ inputTokens: null, outputTokens: null, model: null })
  })

  test("codex tolerates a stub that omits the usage field (undefined)", async () => {
    const client = {
      startThread: () => ({
        run: async () => ({ items: [], finalResponse: "ok" })
      })
    } as any
    const driver = CodexAgent.make({ client })
    const reported: DriverEvent[] = []
    await Effect.runPromise(driver.run({
      context: AgentContext.raw("x"), until: Until.stop, access: [],
      report: (event) => Effect.sync(() => reported.push(event))
    }))
    const usageEvent = reported.find((e) => e._tag === "UsageReported") as { usage: UsageReport } | undefined
    expect(usageEvent?.usage).toEqual({ inputTokens: null, outputTokens: null, model: null })
  })

  test("a failing usage hook never kills the run", async () => {
    const model = new MockLanguageModelV4({ doGenerate: textResult })
    const driver = VercelAgent.make({ model })
    const output = await Effect.runPromise(driver.run({
      context: AgentContext.raw("x"), until: Until.stop, access: [],
      report: () => Effect.die(new Error("usage hook boom"))
    }))
    expect(output).toBe("ok")
  })
})