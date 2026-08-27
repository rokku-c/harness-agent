import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { ConnectionRuntime } from "@effect-agent/core"
import { NotationCapabilities, memoryNotationStore, notationAdapter, notationConnectionSpec, ProviderCapabilities, providerAdapter, providerConnectionSpec } from "@effect-agent/builtin"

describe("provider and notation connections", () => {
  test("provider exposes injected catalog and model invocation", async () => {
    const adapter = providerAdapter({
      kind: "test.provider",
      resolver: {
        names: ["demo"], default: "demo",
        config: () => ({ api: "test", model: "demo" }),
        model: () => ({ specificationVersion: "v2", provider: "test", modelId: "demo", doGenerate: async () => ({ finishReason: "stop", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, content: [{ type: "text", text: "ok" }] }), doStream: async () => { throw new Error("unused") } } as any)
      }
    })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      adapters: [adapter], specs: [providerConnectionSpec({ id: "providers", adapters: [{ kind: adapter.kind }] })]
    }))
    expect(await Effect.runPromise(runtime.invoke("providers", ProviderCapabilities.list, {}))).toEqual({ names: ["demo"], default: "demo" })
    expect((await Effect.runPromise(runtime.invoke("providers", ProviderCapabilities.generate, { prompt: "hi" })) as any).text).toBe("ok")
  })

  test("notation versions, patching and diff are available as a connection", async () => {
    const store = memoryNotationStore([{ target: "tool:echo", description: "short" }])
    const adapter = notationAdapter({ kind: "test.notation", store })
    const runtime = await Effect.runPromise(ConnectionRuntime.make({
      adapters: [adapter], specs: [notationConnectionSpec({ id: "notation", adapters: [{ kind: adapter.kind }] })]
    }))
    await Effect.runPromise(runtime.invoke("notation", NotationCapabilities.patch, { target: "tool:echo", description: "detailed" }))
    const result = await Effect.runPromise(runtime.invoke("notation", NotationCapabilities.diff, { target: "tool:echo" })) as any
    expect(result.changed).toEqual(["description"])
    expect((await Effect.runPromise(runtime.invoke("notation", NotationCapabilities.history, { target: "tool:echo" })) as any)).toHaveLength(2)
  })
})
