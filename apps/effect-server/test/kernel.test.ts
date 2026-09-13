import { expect, test } from "bun:test"
import { KernelIncompatibleError } from "@effect-agent/effect-bundle"
import { HOST, KERNEL, assertKernelBootable } from "../src/boot/kernel.ts"
import { bootRuntime } from "../src/boot/runtime.ts"

test("the kernel this build ships is one the host can run", () => {
  expect(assertKernelBootable()).toBe(KERNEL)
  expect(KERNEL.runtimes).toEqual(["os"])
  expect(HOST.runtime).toBe("os")
})

test("boot refuses a kernel that needs a bootstrap line this host does not implement", async () => {
  const staged = { ...KERNEL, kernelId: "io.effect-agent.kernel@2.0.0", bootstrapAbi: "bootstrap-2" }

  // the gate itself
  expect(() => assertKernelBootable(staged)).toThrow(KernelIncompatibleError)

  // and it is on the boot path: nothing gets built — no root is even scanned
  await expect(bootRuntime(["/nonexistent-root"], new Set<string>(), { kernel: staged }))
    .rejects.toThrow(KernelIncompatibleError)
})

test("boot refuses a kernel that cannot run in this process's runtime", async () => {
  const staged = { ...KERNEL, runtimes: ["browser"] as const }

  await expect(bootRuntime(["/nonexistent-root"], new Set<string>(), { kernel: staged }))
    .rejects.toThrow(KernelIncompatibleError)
})
