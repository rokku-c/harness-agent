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
  ops.setTheme("dark")
  ops.setRenderer("canvas")
  expect(runtime.view({ user: { name: "Ada" } }).children[0]!.resolvedProps.value).toBe("Ada")
  expect(runtime.theme()).toBe("dark")
  expect(runtime.renderer()).toBe("canvas")
})

test("lists declared building blocks", () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  store.registerComponent({ type: "Text", version: "1", category: "base" })
  expect(makeUIAgentOps(runtime, store).listComponents().map((item) => item.type)).toEqual(["Text"])
})

test("agent ops link and enter a child canvas", async () => {
  const store = makeDefinitionStore()
  const runtime = makeUIRuntime(store, "root")
  const ops = makeUIAgentOps(runtime)
  ops.createCanvas("root", "Root")
  ops.createCanvas("child", "Child")
  ops.linkCanvas("root", "child-ref", "child")
  await ops.enterCanvas("child")
  expect(runtime.navigation().current).toBe("child")
})
