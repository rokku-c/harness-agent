import { expect, mock, test } from "bun:test"
import { z } from "@effect-agent/effect-config"
import { makeEffectRegistry, type EffectTool } from "@effect-agent/effect-interface"
import { invokeAppTool } from "../src/index.ts"

const appFor = (tool: EffectTool) => {
  const registry = makeEffectRegistry()
  registry.registerInterface({ id: "board", tools: [tool] })
  return { ns: "ops", appId: "board", registry, authorize: () => true }
}

test("zod invalid input never reaches handler; valid input is parsed first", async () => {
  const handler = mock((input: unknown) => input)
  const app = appFor({ name: "echo", input: z.object({ text: z.string().trim() }), handler })
  await expect(invokeAppTool(app, "echo", { text: 42 })).rejects.toThrow("invalid arguments")
  expect(handler).not.toHaveBeenCalled()
  expect(await invokeAppTool(app, "echo", { text: " hi " })).toEqual({ text: "hi" })
  expect(handler).toHaveBeenCalledWith({ text: "hi" })
})

test("JSON-only tool contracts validate before handler invocation", async () => {
  const handler = mock((input: unknown) => input)
  const app = appFor({ name: "echo", handler, inputSchema: {
    type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false,
  } })
  for (const args of [{}, { text: 1 }, { text: "hi", extra: true }, null]) {
    await expect(invokeAppTool(app, "echo", args)).rejects.toThrow("invalid arguments")
  }
  expect(handler).not.toHaveBeenCalled()
  expect(await invokeAppTool(app, "echo", { text: "hi" })).toEqual({ text: "hi" })
  expect(handler).toHaveBeenCalledTimes(1)
})

test("schema $ids do not leak validators across tools", async () => {
  const first = appFor({ name: "echo", inputSchema: { $id: "same", type: "string" }, handler: (x) => x })
  const handler = mock((x: unknown) => x)
  const second = appFor({ name: "echo", inputSchema: { $id: "same", type: "number" }, handler })
  expect(await invokeAppTool(first, "echo", "hi")).toBe("hi")
  await expect(invokeAppTool(second, "echo", "hi")).rejects.toThrow("invalid arguments")
  expect(handler).not.toHaveBeenCalled()
  expect(await invokeAppTool(second, "echo", 3)).toBe(3)
})

test("false JSON schemas deny all input without running a handler", async () => {
  const handler = mock(() => "wrong")
  await expect(invokeAppTool(appFor({ name: "echo", inputSchema: false, handler }), "echo", {}))
    .rejects.toThrow("invalid arguments")
  expect(handler).not.toHaveBeenCalled()
})
