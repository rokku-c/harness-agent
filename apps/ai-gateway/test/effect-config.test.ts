import { expect, test } from "bun:test"
import { mergeConfig, toJsonSchema } from "@effect-agent/effect-config"
import { effectConfig } from "../src/effect-config.ts"
import { gatewayConfig } from "../src/config.ts"
import { providers } from "./helpers.ts"

test("configuration has no providers or credentials by default", () => {
  const out = mergeConfig(effectConfig)
  expect(out.ok).toBe(true)
  expect(out.value).toEqual({})
  expect(gatewayConfig().providers).toBeUndefined()
})

test("providers and optional runtime fields are validated and retained", () => {
  const value = { providers, database: ":memory:", captureBodies: true,
    rules: [{ ruleId: "scope", inject: { content: "Stay scoped", position: "system-suffix" } }] }
  const out = mergeConfig(effectConfig, { yaml: value })
  expect(out.ok).toBe(true)
  expect(out.value).toEqual(value)
  expect(out.sources).toEqual({ providers: "yaml", database: "yaml", captureBodies: "yaml", rules: "yaml" })
})

test("IDs are unique across protocols, while any number of same-type providers is allowed", () => {
  const repeated = ["a", "b", "c", "d"].map(id => ({ id, apiType: "openai.chat" as const, baseURL: "http://local.test" }))
  expect(effectConfig.schema.parse({ providers: repeated })).toEqual({ providers: repeated })
  expect(effectConfig.schema.parse({ providers: [{ ...providers[0], enabled: false }] }).providers![0].enabled).toBe(false)
  for (const apiType of providers.map(provider => provider.apiType)) {
    const parsed = effectConfig.schema.safeParse({ providers: [providers[0], { ...providers[0], apiType }] })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.error.issues[0]).toMatchObject({
      path: ["providers", 1, "id"], message: "duplicate provider id: chat",
    })
  }
})

test("providers require an ID and explicit HTTP(S) URL, not a key or enabled flag", () => {
  const required = { id: "local", apiType: "openai.chat" as const, baseURL: "http://local.test" }
  expect(effectConfig.schema.parse({ providers: [required] })).toEqual({ providers: [required] })
  for (const baseURL of [undefined, "", "relative/path", "ftp://upstream.test", "https://user:password@upstream.test"]) {
    expect(effectConfig.schema.safeParse({ providers: [{ ...required, baseURL }] }).success).toBe(false)
  }
  for (const patch of [{ id: undefined }, { id: "" }, { id: " " }, { apiType: "other" }, { enabled: "false" }, { apiKey: null }]) {
    expect(effectConfig.schema.safeParse({ providers: [{ ...required, ...patch }] }).success).toBe(false)
  }
})

test("strict schemas reject old fields, missing provider IDs and unknown nested options", () => {
  for (const key of ["chatBaseURL", "responsesBaseURL", "messageBaseURL", "upstreamBase", "anthropicUpstream",
    "chatApiKey", "responsesApiKey", "messageApiKey", "apiKey", "anthropicApiKey"]) {
    for (const value of [{ [key]: "old" }, { providers, [key]: "old" }]) {
      expect(effectConfig.schema.safeParse(value).success).toBe(false)
      expect(mergeConfig(effectConfig, { yaml: value }).ok).toBe(false)
    }
  }
  const { id, ...unnamed } = providers[0]
  expect(effectConfig.schema.safeParse({ providers: [unnamed] }).success).toBe(false)
  expect(effectConfig.schema.safeParse({ providers: [{ ...providers[0], upstreamBase: "old" }] }).success).toBe(false)
  expect(effectConfig.schema.safeParse({ rules: [{ ruleId: "r", inject: { content: "x", old: true } }] }).success).toBe(false)
})

test("JSON Schema exposes exactly named provider fields with only ID/type/URL required", () => {
  const schema = toJsonSchema(effectConfig.schema) as {
    additionalProperties: boolean; properties: Record<string, any>
  }
  expect(schema.additionalProperties).toBe(false)
  expect(Object.keys(schema.properties).sort()).toEqual(["captureBodies", "database", "providers", "rules"])
  const item = schema.properties.providers.items
  expect(Object.keys(item.properties)).toEqual(["id", "apiType", "baseURL", "apiKey", "enabled"])
  expect(item.required).toEqual(["id", "apiType", "baseURL"])
  expect(item.additionalProperties).toBe(false)
})

test("listener ports are not application configuration and are never read as runtime defaults", () => {
  expect(effectConfig.schema.safeParse({ port: 0 }).success).toBe(false)
  expect(mergeConfig(effectConfig, { yaml: { port: 4890 } }).ok).toBe(false)
  expect(gatewayConfig()).not.toHaveProperty("port")
})
