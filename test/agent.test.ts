import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { any, connection, defineAgent, memoryNotationStore, named, type Llm, type LlmResult } from "../src/index.ts"

/** A scripted Llm: queued results, records every call. */
const scriptedLlm = (queue: Array<(calls: { prompts: string[]; tools: string[] }) => LlmResult>) => {
  const seen: { prompts: string[]; tools: string[] } = { prompts: [], tools: [] }
  return {
    llm: {
      generate: (prompt: string, _messages: unknown, tools: ReadonlyArray<{ name: string }>) => {
        seen.prompts.push(prompt)
        seen.tools = tools.map((tool) => tool.name)
        const next = queue.shift()
        if (next === undefined) throw new Error("scripted llm exhausted")
        return Effect.succeed(next(seen))
      }
    } as Llm,
    seen
  }
}

describe("agent", () => {
  test("definition order: connections first, then the loop runs tool calls to a reply", async () => {
    const store = memoryNotationStore([{ target: "assistant/prompt", instructions: ["You are terse."] }])
    const tools = connection("grafana", [
      { name: "list_dashboards", input: { type: "object" }, output: { type: "array" }, execute: () => Effect.succeed(["one"]) }
    ])
    const { llm, seen } = scriptedLlm([
      () => ({ text: "checking", toolCalls: [{ id: "1", name: "grafana__list_dashboards", input: {} }] }),
      () => ({ text: "one dashboard exists", toolCalls: [] })
    ])
    const agent = defineAgent({
      name: "ops",
      connections: { grafana: named("grafana") },
      prompt: { store, target: "assistant/prompt" }
    }, llm)
    agent.applyTools([tools])
    const reply = await Effect.runPromise(agent.invokeMessage("how many dashboards?"))
    expect(reply).toBe("one dashboard exists")
    // the tool ran and its result entered the log
    expect(agent.listMessages().some((m) => m.role === "tool" && m.content.includes("one"))).toBe(true)
    expect(agent.listTurns()).toHaveLength(1)
    // the notation-injected system prompt reached the model
    expect(seen.prompts[0]).toBe("You are terse.")
  })

  test("applyTools re-binds in real time", () => {
    const store = memoryNotationStore([{ target: "p", instructions: ["go"] }])
    const { llm } = scriptedLlm([() => ({ text: "done", toolCalls: [] })])
    const agent = defineAgent({ name: "a", connections: { mcp: any() }, prompt: { store, target: "p" } }, llm)
    agent.applyTools([connection("anything", [])])
    expect(() => agent.applyTools([])).toThrow(/was not provided/)
  })

  test("agent-as-connection: a parent depends on a child agent", async () => {
    const store = memoryNotationStore([{ target: "p", instructions: ["go"] }])
    const child = defineAgent({
      name: "reviewer",
      connections: {},
      prompt: { store: memoryNotationStore([{ target: "p", instructions: ["review"] }]), target: "p" }
    }, scriptedLlm([() => ({ text: "looks good", toolCalls: [] })]).llm)
    const parent = defineAgent({
      name: "lead",
      connections: {},
      agents: [child],
      prompt: { store, target: "p" }
    }, scriptedLlm([
      () => ({ text: "asking", toolCalls: [{ id: "1", name: "reviewer__invokeMessage", input: { message: "review this" } }] }),
      () => ({ text: "child said: looks good", toolCalls: [] })
    ]).llm)
    const reply = await Effect.runPromise(parent.invokeMessage("run the review"))
    expect(reply).toBe("child said: looks good")
    // the child received its own invocation through the connection surface
    expect(child.listMessages()[0]).toEqual({ role: "user", content: "review this" })
    // the parent's tool surface carried the child's prefixed tool
    expect(child.asConnection.name).toBe("reviewer")
  })
})
