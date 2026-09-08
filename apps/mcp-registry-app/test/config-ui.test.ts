import { expect, test } from "bun:test"
import { toJsonSchema } from "@effect-agent/effect-config"
import { effectConfig } from "../src/effect-config.ts"

test("registry config declares topology, leases and credentials without legacy fields", () => {
  const schema = toJsonSchema(effectConfig.schema) as { properties: Record<string, unknown> }
  for (const key of ["servers", "heartbeatTtlMs", "offlineAfterMs", "registrationTokens"]) expect(schema.properties[key]).toBeDefined()
  for (const key of ["registryFile", "autoRegister"]) expect(schema.properties[key]).toBeUndefined()
  const value = effectConfig.schema.parse({})
  expect(value.servers).toEqual([]); expect(value.registrationTokens).toEqual({})
})
