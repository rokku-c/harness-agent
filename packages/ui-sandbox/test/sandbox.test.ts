import { expect, test } from "bun:test"
import { denySandbox, guardedSandbox, validateSandboxRequest } from "../src/index.ts"

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
