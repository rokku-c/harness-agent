import { expect, test } from "bun:test"
import { toJsonSchema } from "@effect-agent/effect-config"
import { effectConfig } from "../src/effect-config.ts"
import { effectUiView } from "../src/effect-ui.ts"

const SCHEMA_FIELDS = ["sets", "bindings", "defaultAction", "captureArgs"]

test("mcp-gateway config exposes only sets, bindings, and policy fields", () => {
  const schema = toJsonSchema(effectConfig.schema) as { type: string; properties: Record<string, unknown> }
  expect(schema.type).toBe("object")
  expect(Object.keys(schema.properties).sort()).toEqual([...SCHEMA_FIELDS].sort())
})

test("mcp-gateway rejects the removed servers config field", () => {
  expect(effectConfig.schema.parse({})).toMatchObject({ defaultAction: "deny", sets: [], bindings: [] })
  expect(() => effectConfig.schema.parse({ servers: [] })).toThrow()
})

test("mcp-gateway console view declares a non-empty node list", () => {
  expect(effectUiView.nodes.length).toBeGreaterThan(0)
  expect(effectUiView.viewId).toBe("mcp-gateway-console")
})
