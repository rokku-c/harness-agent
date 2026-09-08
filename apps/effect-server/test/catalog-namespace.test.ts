import { expect, test } from "bun:test"
import { makeEffectRegistry } from "@effect-agent/effect-interface"
import { invokeAppTool } from "@effect-agent/effect-apps"
import { makeLiveAppCatalog } from "../src/apps-catalog.ts"
import { memoryConfigs } from "./config-helpers.ts"

test("foreign namespaced interfaces cannot masquerade as a legacy local appId", async () => {
  const registry = makeEffectRegistry()
  let secretCalls = 0
  registry.registerInterface({ id: "ops::a", tools: [{ name: "echo", handler: () => "local" }] })
  registry.registerInterface({ id: "other::b", tools: [{ name: "echo", handler: () => { secretCalls++; return "secret" } }] })
  const catalog = makeLiveAppCatalog({ registry, configs: memoryConfigs(), namespace: "ops", authorize: () => true })
  expect(catalog.list().map((app) => app.appId)).toEqual(["a"])
  expect(catalog.find("ops", "other::b")).toBeUndefined()
  expect(await invokeAppTool(catalog.find("ops", "a")!, "echo", {})).toBe("local")
  await expect(invokeAppTool({ ns: "ops", appId: "other::b", registry, authorize: () => true }, "echo", {})).rejects.toThrow()
  expect(secretCalls).toBe(0)
})
