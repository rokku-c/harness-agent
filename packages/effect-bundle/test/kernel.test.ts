import { expect, test } from "bun:test"
import {
  assessKernelAgainst,
  assessKernelCompat,
  assertKernelCompat,
  BOOTSTRAP_ABI,
  describeKernel,
  KernelIncompatibleError,
  type KernelDeclaration,
} from "../src/index.ts"

const kernel = (over: Partial<KernelDeclaration> = {}): KernelDeclaration => ({
  kernelId: "io.effect-agent.kernel@1.0.0",
  abi: "effect-1",
  bootstrapAbi: BOOTSTRAP_ABI,
  runtimes: ["os"],
  ...over,
})

test("the host's own bootstrap line is accepted", () => {
  expect(assessKernelCompat(kernel())).toEqual({ ok: true })
})

test("a kernel needing a bootstrap line the host does not implement is refused", () => {
  const verdict = assessKernelCompat(kernel({ bootstrapAbi: "bootstrap-2" }))

  expect(verdict.ok).toBe(false)
  if (verdict.ok) return
  expect(verdict.reason.code).toBe("abi-mismatch")
  // the line is what tells an operator WHICH contract failed
  expect(verdict.reason.line).toBe("bootstrap")
  expect(verdict.reason.message).toContain("bootstrap-2")
  expect(verdict.reason.message).toContain("bootstrap-1")
})

test("an unparseable bootstrap abi is refused on either side, not waved through", () => {
  const fromKernel = assessKernelCompat(kernel({ bootstrapAbi: "v1" }))
  expect(fromKernel.ok).toBe(false)
  if (!fromKernel.ok) expect(fromKernel.reason.code).toBe("abi-unparseable")

  const fromHost = assessKernelCompat(kernel(), { bootstrapAbi: "nonsense" })
  expect(fromHost.ok).toBe(false)
  if (!fromHost.ok) expect(fromHost.reason.code).toBe("abi-unparseable")
})

test("a kernel that cannot run in the host's runtime is refused", () => {
  const verdict = assessKernelCompat(kernel({ runtimes: ["browser"] }), { runtime: "os" })

  expect(verdict.ok).toBe(false)
  if (verdict.ok) return
  expect(verdict.reason.code).toBe("runtime-unsupported")
  // a runtime refusal is not an ABI-line refusal
  expect(verdict.reason.line).toBeUndefined()
})

test("a kernel that declares no runtimes is treated as os-only (conservative default)", () => {
  const { runtimes: _omitted, ...bare } = kernel()
  expect(assessKernelCompat(bare)).toEqual({ ok: true })
  expect(assessKernelCompat(bare, { runtime: "browser" }).ok).toBe(false)
})

test("assertKernelCompat throws a typed refusal carrying the reason", () => {
  expect(() => assertKernelCompat(kernel())).not.toThrow()

  let thrown: unknown
  try {
    assertKernelCompat(kernel({ bootstrapAbi: "bootstrap-2" }))
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(KernelIncompatibleError)
  const typed = thrown as KernelIncompatibleError
  expect(typed.message).toContain("io.effect-agent.kernel@1.0.0")
  expect(typed.message).toContain("refused")
  expect(typed.reason.code).toBe("abi-mismatch")
})

test("a kernel swap is checked against every loaded app before it happens", () => {
  const apps = [
    { appId: "board", declaration: { bundleId: "io.effect-agent.board@1.0.0", abi: "effect-1" } },
    { appId: "mantis", declaration: { bundleId: "io.effect-agent.mantis@1.0.0", abi: "effect-1" } },
  ]
  expect(assessKernelAgainst(kernel(), apps)).toEqual([])

  // the incoming kernel implements a line the loaded apps do not speak
  const breaking = assessKernelAgainst(kernel({ abi: "effect-2" }), apps)
  // Named the way the app layer names them, so §6.5-6 can suspend exactly these...
  expect(breaking.map((entry) => entry.app)).toEqual(["board", "mantis"])
  expect(breaking[0].reason.line).toBe("effect")
  // ...while the reason still says which *build* that was, version and all.
  expect(breaking[0].reason.message).toContain("io.effect-agent.board@1.0.0")
  expect(breaking[0].reason.message).toContain("effect-1")
})

test("the app matrix also carries the runtime, so a browser kernel cannot adopt os-only apps", () => {
  const apps = [{ appId: "board", declaration: { bundleId: "io.effect-agent.board@1.0.0", abi: "effect-1", runtimes: ["os"] } }]
  expect(assessKernelAgainst(kernel(), apps)).toEqual([])

  const breaking = assessKernelAgainst(kernel(), apps, { runtime: "browser" })
  expect(breaking).toHaveLength(1)
  expect(breaking[0].app).toBe("board")
  expect(breaking[0].reason.code).toBe("runtime-unsupported")
})

test("describeKernel reads as a one-line receipt", () => {
  expect(describeKernel(kernel())).toBe("ok: io.effect-agent.kernel@1.0.0 · effect effect-1 · runtimes [os]")
  expect(describeKernel(kernel({ bootstrapAbi: "bootstrap-2" }))).toStartWith("refused(abi-mismatch):")
})
