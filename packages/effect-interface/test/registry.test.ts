import { expect, test } from "bun:test"

import { z } from "zod"
import {
  makeEffectRegistry,
  toJsonSchema,
  invoke,
  type EffectInterface,
  type EffectTool,
} from "../src/index.ts"

const startSchema = z.object({ itemId: z.string(), executorId: z.string().default("console") })

const start: EffectTool<{ itemId: string; executorId: string }, { ok: boolean; itemId: string }> = {
  name: "start",
  description: "start a board item",
  input: startSchema,
  output: z.object({ ok: z.boolean(), itemId: z.string() }),
  handler: ({ itemId }) => ({ ok: true, itemId }),
}

const board: EffectInterface = {
  id: "apps/board",
  title: "Board",
  description: "effect-agent board",
  tools: [start],
}

test("zod input exports as a real JSON schema", () => {
  const schema = toJsonSchema(startSchema) as { type: string; properties: Record<string, unknown>; required?: string[] }
  expect(schema.type).toBe("object")
  expect(schema.properties.itemId).toBeDefined()
  expect(schema.required).toContain("itemId")
})

test("registry lists schemas keyed interfaceId.toolName", () => {
  const registry = makeEffectRegistry()
  registry.registerInterface(board)

  const schemas = registry.schemas()
  expect(schemas.map((s) => s.name)).toEqual(["apps/board.start"])
  expect((schemas[0].parameters as { properties: Record<string, unknown> }).properties.executorId).toBeDefined()
  expect(schemas[0].output).toBeDefined()

  expect(registry.schemaFor("apps/board.start")?.description).toBe("start a board item")
  expect(registry.find("apps/board")?.tools).toHaveLength(1)
})

test("invoke validates input and result, rejecting bad args", async () => {
  const registry = makeEffectRegistry()
  registry.registerInterface(board)

  const entry = registry.tools()[0]
  expect(entry.key).toBe("apps/board.start")

  const ok = await invoke(entry.tool, { itemId: "item-1" })
  expect(ok).toEqual({ ok: true, itemId: "item-1" })

  await expect(invoke(entry.tool, { nope: 1 })).rejects.toThrow("invalid arguments for start")
})

test("registration is a reversible effect: disposer removes exactly its own records", async () => {
  const registry = makeEffectRegistry()
  const dispose = registry.registerInterface(board)
  expect(registry.schemas()).toHaveLength(1)

  dispose()
  expect(registry.schemas()).toHaveLength(0)
  expect(registry.find("apps/board")).toBeUndefined()

  // disposing twice is a no-op
  dispose()
})


test("registry lists registered UI apps alongside tools", () => {
  const registry = makeEffectRegistry()
  registry.registerInterface({
    id: "apps/a",
    tools: [],
    apps: [{ id: "console", title: "A console", resourceUri: "ui://apps/a/console" }],
  })
  expect(registry.apps()).toHaveLength(1)
  expect(registry.apps()[0]).toMatchObject({
    interfaceId: "apps/a",
    app: { id: "console", resourceUri: "ui://apps/a/console" },
  })
})
