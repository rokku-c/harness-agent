import { expect, test } from "bun:test"
import type { ScriptRuntime } from "@effect-agent/script"
import { denySandbox, guardedSandbox, makeIsolatedSandbox, makeNodeSandbox, makeRuntimeSandbox, validateSandboxRequest } from "../src/index.ts"

const extension = { name: "demo", version: "1", permissions: ["execute:script"] as const }
test("requires explicit script permission", () => {
  expect(validateSandboxRequest({ code: "1", extension: { ...extension, permissions: [] } })?.error).toContain("lacks")
})
test("default sandbox never executes code", async () => {
  expect((await denySandbox.execute({ code: "danger()", extension })).ok).toBe(false)
})

test("guarded sandbox rejects before invoking the delegate", async () => {
  let invoked = false
  const sandbox = guardedSandbox({ execute: async () => { invoked = true; return { ok: true } } })
  const result = await sandbox.execute({ code: "danger()", extension: { ...extension, permissions: [] } })
  expect(result.ok).toBe(false)
  expect(invoked).toBe(false)
})

test("validates dependencies and capability permissions", () => {
  expect(validateSandboxRequest({ code: "1", dependencies: ["data.api", "data.api"], extension })).toMatchObject({ ok: false })
  expect(validateSandboxRequest({ code: "1", capabilities: ["emit:event"], extension })).toMatchObject({ ok: false })
})

test("runtime sandbox injects only declared dependencies", async () => {
  const runtime: ScriptRuntime = { runtime: "node-vm", execute: async (_code, env) => Object.keys(env) }
  const sandbox = makeRuntimeSandbox(runtime, { allowed: { name: "allowed", invoke: async () => 1 }, hidden: { name: "hidden", invoke: async () => 2 } })
  const result = await sandbox.execute({ code: "", dependencies: ["allowed"], extension })
  expect(result).toEqual({ ok: true, value: ["allowed"] })
})

test("runtime failures return a readable sandbox result", async () => {
  const runtime: ScriptRuntime = { runtime: "node-vm", execute: async () => { throw new Error("script failed") } }
  const result = await makeRuntimeSandbox(runtime).execute({ code: "throw", extension })
  expect(result).toEqual({ ok: false, error: "script failed" })
})

test("reports a missing declared dependency", async () => {
  const runtime: ScriptRuntime = { runtime: "node-vm", execute: async () => 1 }
  const result = await makeRuntimeSandbox(runtime).execute({ code: "", dependencies: ["missing"], extension })
  expect(result).toEqual({ ok: false, error: "missing dependency: missing" })
})

test("isolated factory guards invalid requests before native loading", async () => {
  const result = await makeIsolatedSandbox().execute({ code: "", extension: { ...extension, permissions: [] } })
  expect(result.error).toContain("lacks execute:script")
})

test("node fallback executes through the same contract", async () => {
  const result = await makeNodeSandbox().execute({ code: "return 42", extension })
  expect(result).toEqual({ ok: true, value: 42 })
})
