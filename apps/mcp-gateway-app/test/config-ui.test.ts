import { expect, test } from "bun:test"
import { toJsonSchema } from "@effect-agent/effect-config"
import { effectConfig } from "../src/effect-config.ts"
import { effectUiView } from "../src/effect-ui.ts"

const SCHEMA_FIELDS = ["databaseFile", "captureArgs"]

test("mcp-gateway config exposes only what the gateway itself says", () => {
  const schema = toJsonSchema(effectConfig.schema) as { type: string; properties: Record<string, unknown> }
  expect(schema.type).toBe("object")
  expect(Object.keys(schema.properties).sort()).toEqual([...SCHEMA_FIELDS].sort())
})

test("mcp-gateway rejects the fields that belong to another surface", () => {
  expect(effectConfig.schema.parse({})).toMatchObject({ captureArgs: false })
  expect(() => effectConfig.schema.parse({ servers: [] })).toThrow()
  // A set and a binding are declared in the center that issues the identity they
  // are keyed by, and this app reads them from there. A second declaration here
  // was the same fact with two authors and nothing keeping them in step, so it
  // is refused rather than stored.
  expect(() => effectConfig.schema.parse({ sets: [] })).toThrow()
  expect(() => effectConfig.schema.parse({ bindings: [] })).toThrow()
  // the sets decide what an agent may reach, so a second verdict is refused here
  // rather than stored: an accepted `defaultAction` would be one nobody reads
  expect(() => effectConfig.schema.parse({ defaultAction: "deny" })).toThrow()
})

test("mcp-gateway console view declares a non-empty node list", () => {
  expect(effectUiView.nodes.length).toBeGreaterThan(0)
  expect(effectUiView.viewId).toBe("mcp-gateway-console")
})
