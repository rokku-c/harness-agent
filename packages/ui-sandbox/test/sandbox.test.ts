import { expect, test } from "bun:test"
import { denySandbox, validateSandboxRequest } from "../src/index.ts"

const extension = { name: "demo", version: "1", permissions: ["execute:script"] as const }
test("requires explicit script permission", () => {
  expect(validateSandboxRequest({ code: "1", extension: { ...extension, permissions: [] } })?.error).toContain("lacks")
})
test("default sandbox never executes code", async () => {
  expect((await denySandbox.execute({ code: "danger()", extension })).ok).toBe(false)
})
