import { expect, test } from "bun:test"
import { makeDefinitionStore } from "@effect-agent/ui-definition"
import { makeUIRuntime } from "@effect-agent/ui-runtime"
import { makeUIAgentOps } from "../src/index.ts"

test("agent ops compose and bind UI", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  const ops = makeUIAgentOps(runtime)
  ops.createCanvas("root", "Root")
  ops.insertNode("root", { id: "name", type: "Text" })
  ops.bindNode("root", "name", "value", { kind: "path", value: "$.user.name" })
  expect(runtime.view({ user: { name: "Ada" } }).children[0]!.resolvedProps.value).toBe("Ada")
})

test("lists declared building blocks", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  store.registerComponent({ type: "Text", version: "1", category: "base" })
  expect(makeUIAgentOps(runtime, store).listComponents().map((item) => item.type)).toEqual(["Text"])
})
