import { expect, test } from "bun:test"

import { mergeConfig, toJsonSchema } from "@effect-agent/effect-config"

import { effectConfig } from "../src/effect-config.ts"

test("deckconsole config merges effect.yaml config with defaults and per-key provenance", () => {
  const out = mergeConfig(effectConfig, {
    // same keys as the `config:` sample in apps/deckconsole/effect.yaml
    yaml: { host: "0.0.0.0", port: 4860 },
  })
  expect(out.ok).toBe(true)
  expect(out.appId).toBe("deckconsole")

  const value = out.value as Record<string, unknown>
  // yaml-provided fields win
  expect(value.host).toBe("0.0.0.0")
  expect(value.port).toBe(4860)
  // defaults applied for unset fields
  expect(value.configFile).toBe(".effect-agent/deckconsole.sqlite")

  expect(out.sources).toEqual({
    host: "yaml",
    port: "yaml",
    configFile: "default",
  })
})

test("deckconsole config schema exports as an object JSON schema with all fields", () => {
  const schema = toJsonSchema(effectConfig.schema) as {
    type: string
    properties: Record<string, unknown>
  }
  expect(schema.type).toBe("object")
  for (const key of ["host", "port", "configFile"]) {
    expect(schema.properties[key]).toBeDefined()
  }
})
