import { expect, test } from "bun:test"

import { mergeConfig, toJsonSchema } from "@effect-agent/effect-config"

import { effectConfig } from "../src/effect-config.ts"

test("ui-host config merges effect.yaml config with defaults and per-key provenance", () => {
  const out = mergeConfig(effectConfig, {
    // same keys as the `config:` sample in apps/ui-host/effect.yaml
    yaml: { port: 4875, theme: "dusk" },
  })
  expect(out.ok).toBe(true)
  expect(out.appId).toBe("ui-host")

  const value = out.value as Record<string, unknown>
  // yaml-provided fields win
  expect(value.port).toBe(4875)
  expect(value.theme).toBe("dusk")
  // defaults applied for unset fields
  expect(value.host).toBe("127.0.0.1")
  expect(value.renderer).toBe("web-html")

  expect(out.sources).toEqual({
    port: "yaml",
    theme: "yaml",
    host: "default",
    renderer: "default",
    databaseFile: "default",
  })
})

test("ui-host config schema exports as an object JSON schema with all fields", () => {
  const schema = toJsonSchema(effectConfig.schema) as {
    type: string
    properties: Record<string, unknown>
  }
  expect(schema.type).toBe("object")
  for (const key of ["host", "port", "theme", "renderer", "databaseFile"]) {
    expect(schema.properties[key]).toBeDefined()
  }
})
