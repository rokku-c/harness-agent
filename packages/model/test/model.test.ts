import { describe, expect, it, mock } from "bun:test"
import { Effect } from "effect"
import { ModelLayer, echoModel, openaiModel, anthropicModel, ModelCatalogImpl } from "@effect-agent/model"

describe("model contract", () => {
  it("echo model returns the last message", async () => {
    const result = await Effect.runPromise(
      echoModel.generate("sys", [{ role: "user", content: "hi" }], [])
    )
    expect(result.text).toContain("hi")
    expect(result.toolCalls).toEqual([])
  })

  it("openaiModel builds a chat.completions request", async () => {
    const calls: Array<Record<string, unknown>> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: unknown, init?: unknown) => {
      calls.push({ url, init })
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "ok", tool_calls: [{ id: "c1", function: { name: "f", arguments: '{"a":1}' } }] } }]
        }),
        { status: 200 }
      )
    }) as typeof fetch
    try {
      const model = openaiModel({ api: "openai.chat", model: "gpt-4o", apiKey: "k" })
      expect(model.id).toBe("openai:gpt-4o")
      const result = await Effect.runPromise(
        model.generate("sys", [{ role: "user", content: "hi" }], [{ name: "f", description: "f", input: {} }])
      )
      expect(result.text).toBe("ok")
      expect(result.toolCalls).toEqual([{ id: "c1", name: "f", input: { a: 1 } }])
      const body = (calls[0]?.init as RequestInit).body as string
      expect(body).toContain('"model":"gpt-4o"')
      expect(body).not.toContain('"apiKey"')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("anthropicModel builds a messages request", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ content: [{ type: "text", text: "hi" }, { type: "tool_use", id: "t1", name: "f", input: {} }] }),
        { status: 200 }
      )
    ) as typeof fetch
    const model = anthropicModel({ api: "anthropic.messages", model: "claude-3-7", apiKey: "k" })
    expect(model.capabilities.thinking).toBe(true)
    const result = await Effect.runPromise(model.generate("sys", [{ role: "user", content: "hi" }], []))
    expect(result.text).toBe("hi")
    expect(result.toolCalls).toEqual([{ id: "t1", name: "f", input: {} }])
  })

  it("ModelLayer.require fails loud on missing capability (M3)", () => {
    expect(ModelLayer.require(echoModel, { streaming: true })).toContain("does not support streaming")
    expect(ModelLayer.require(echoModel, {})).toBeNull()
  })

  it("ModelCatalogImpl resolves default and named providers", () => {
    const catalog = new ModelCatalogImpl({
      fast: { api: "openai.chat", model: "gpt-4o-mini" },
      deep: { api: "anthropic.messages", model: "claude-3-7" }
    })
    expect(catalog.names).toEqual(["fast", "deep"])
    expect(catalog.model().id).toBe("openai:gpt-4o-mini")
    expect(catalog.model("deep").id).toBe("anthropic:claude-3-7")
    expect(() => catalog.model("nope")).toThrow()
  })
})
