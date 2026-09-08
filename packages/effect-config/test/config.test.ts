import { expect, test } from "bun:test"

import { z } from "zod"
import {
  makeConfigRegistry,
  mergeConfig,
  toJsonSchema,
  type ConfigDeclaration,
} from "../src/index.ts"

const boardSchema = z.object({
  dataFile: z.string().default(".effect-agent/board.jsonl"),
  webPort: z.number().int().default(3999),
  captureBodies: z.boolean().default(false),
  coordinator: z.enum(["none", "deepseek", "openai"]).default("none"),
})

const board: ConfigDeclaration<typeof boardSchema> = {
  appId: "board",
  title: "Board",
  description: "effect-agent board",
  schema: boardSchema,
}

test("config schema exports as JSON Schema (schema-declared config)", () => {
  const schema = toJsonSchema(boardSchema) as { type: string; properties: Record<string, unknown> }
  expect(schema.type).toBe("object")
  expect(schema.properties.dataFile).toBeDefined()
  expect(schema.properties.coordinator).toBeDefined()
})

test("merge layers defaults <- yaml <- override with per-key provenance", () => {
  const out = mergeConfig(board, {
    yaml: { dataFile: ".effect-agent/board.jsonl", webPort: 4999 },
    override: { coordinator: "deepseek" },
  })
  expect(out.ok).toBe(true)
  expect((out.value as Record<string, unknown>).dataFile).toBe(".effect-agent/board.jsonl")
  expect((out.value as Record<string, unknown>).webPort).toBe(4999)
  expect((out.value as Record<string, unknown>).coordinator).toBe("deepseek")
  expect(out.sources).toEqual({ dataFile: "yaml", webPort: "yaml", coordinator: "override", captureBodies: "default" })
})

test("merge validates and reports errors", () => {
  const out = mergeConfig(board, { override: { webPort: "not-a-number" } })
  expect(out.ok).toBe(false)
  expect(out.error).toContain("webPort")
})

test("registry register/list/get/schemaFor/apply + reversible disposer", () => {
  const registry = makeConfigRegistry()
  const dispose = registry.register(board)
  expect(registry.list().map((d) => d.appId)).toEqual(["board"])
  expect(registry.get("board")?.title).toBe("Board")
  expect(registry.schemaFor("board")).toBeDefined()

  const applied = registry.apply("board", { yaml: { webPort: 8080 } })
  expect(applied.ok).toBe(true)
  expect((applied.value as Record<string, unknown>).webPort).toBe(8080)

  dispose()
  expect(registry.list()).toHaveLength(0)
  expect(registry.apply("board").ok).toBe(false)
  dispose() // no-op
})
