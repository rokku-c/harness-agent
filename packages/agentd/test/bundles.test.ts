/**
 * P6: agentd pushes code artifacts and takes receipts.
 *
 * The property worth testing is not "a plan can be built" — it is that the
 * distribution side refuses exactly what the host would refuse. So the load-path
 * gate (`@effect-agent/effect-bundle`) and the push-path gate
 * (`assessBundleForMachine`) are asserted to agree, and the machine's own
 * defaults are asserted to be the SDK's, not a second set invented here.
 */

import { expect, test } from "bun:test"
import { assessBundleCompat, KERNEL_ABI, BOOTSTRAP_ABI } from "@effect-agent/effect-bundle"
import {
  AgentdError, assessBundleForMachine, kernelRevisionOf, machineCapability, makeAgentdControl, makeBundleArtifactAdapter,
  type BundleRef, type Machine,
} from "../src/index.ts"

const machine = (capabilities: readonly string[] = [], machineId = "m1"): Machine =>
  ({ machineId, name: "dev", status: "online", capabilities, namespaces: [], reportedAt: 1 })
const agent = { agentId: "a1", machineId: "m1", kind: "claude", version: "1", status: "online" as const }
const app = (version: string, over: Partial<BundleRef> = {}): BundleRef =>
  ({ bundleId: "board", version, abi: KERNEL_ABI, ...over })
const kernel = (version: string, over: Partial<BundleRef> = {}): BundleRef =>
  ({ bundleId: "io.effect-agent.kernel", version, abi: KERNEL_ABI, bootstrapAbi: BOOTSTRAP_ABI, kind: "kernel", ...over })

/** The whole push, as the control plane would drive it. */
const push = async (control: ReturnType<typeof makeAgentdControl>, machineId = "m1") => {
  const adapter = makeBundleArtifactAdapter()
  const desired = control.desired("a1")
  const plan = adapter.plan(agent, desired)
  return { plan, applied: await adapter.apply(plan) }
}

test("pushing a kernel and an app gives a receipt whose revision matches the push", async () => {
  const control = makeAgentdControl()
  control.registerMachine(machine())
  control.registerAgent(agent)
  control.publishBundle(kernel("1.0.0"))
  control.publishBundle(app("1.0.0"))

  const binding = control.bindBundles("a1", ["io.effect-agent.kernel@1.0.0", "board@1.0.0"])
  const { plan, applied } = await push(control)

  expect(plan.revision).toBe(binding.revision)
  expect(applied.metadata).toEqual({ agentId: "a1", revision: binding.revision })
  expect(applied.artifacts.map((a) => `${a.bundleId}@${a.version}`)).toEqual(["io.effect-agent.kernel@1.0.0", "board@1.0.0"])
  expect(applied.artifacts[0]).toMatchObject({ kind: "kernel", bootstrapAbi: BOOTSTRAP_ABI, runtimes: ["os"] })
  expect(applied.artifacts[1]).toMatchObject({ kind: "app", runtimes: ["os"] })
  // The receipt the executor sends back is accepted against that same revision.
  expect(control.reportApplied("a1", applied.metadata.revision, applied).revision).toBe(binding.revision)
})

test("a stale receipt is refused with 409, like every other agentd receipt", () => {
  const control = makeAgentdControl()
  control.registerMachine(machine()); control.registerAgent(agent)
  control.publishBundle(app("1.0.0"))
  const binding = control.bindBundles("a1", ["board@1.0.0"])
  try {
    control.reportApplied("a1", binding.revision - 1, {})
    throw new Error("expected a 409")
  } catch (error) {
    expect(error).toBeInstanceOf(AgentdError)
    expect((error as AgentdError).status).toBe(409)
  }
})

test("a runtime the machine cannot provide is refused at plan time, naming the artifact", () => {
  const control = makeAgentdControl()
  control.registerMachine(machine(["runtime:browser"])); control.registerAgent(agent)
  control.publishBundle(app("1.0.0", { runtimes: ["os"] }))
  control.bindBundles("a1", ["board@1.0.0"])

  const adapter = makeBundleArtifactAdapter()
  expect(() => adapter.plan(agent, control.desired("a1"))).toThrow(/cannot push board@1\.0\.0 to m1: .*runtime is "browser"/)
})

test("an abi the machine does not implement is refused, on the right line", () => {
  const control = makeAgentdControl()
  control.registerMachine(machine(["abi:effect-1"])); control.registerAgent(agent)
  control.publishBundle(app("1.0.0", { abi: "effect-2" }))
  control.bindBundles("a1", ["board@1.0.0"])

  const adapter = makeBundleArtifactAdapter()
  try {
    adapter.plan(agent, control.desired("a1"))
    throw new Error("expected a refusal")
  } catch (error) {
    expect((error as AgentdError).message).toContain("requires effect-2 but the host implements effect-1")
  }
})

test("a kernel needing another bootstrap line is refused on the bootstrap line, not the effect line", () => {
  const control = makeAgentdControl()
  control.registerMachine(machine(["bootstrap:bootstrap-1"])); control.registerAgent(agent)
  control.publishBundle(kernel("9.0.0", { bootstrapAbi: "bootstrap-9" }))
  control.bindBundles("a1", ["io.effect-agent.kernel@9.0.0"])

  const adapter = makeBundleArtifactAdapter()
  try {
    adapter.plan(agent, control.desired("a1"))
    throw new Error("expected a refusal")
  } catch (error) {
    expect((error as AgentdError).message).toContain("requires bootstrap-9 but the host implements bootstrap-1")
  }
})

test("the push gate and the load gate agree — agentd does not own a second rule set", () => {
  const capability = machineCapability(machine(["abi:effect-2", "runtime:browser"]))
  const artifact = app("1.0.0", { runtimes: ["os"] })
  const pushed = assessBundleForMachine(artifact, capability)
  // What `loadEffectBundle` computes on the host that would receive it.
  const loaded = assessBundleCompat(artifact, { abi: "effect-2", runtime: "browser" })
  expect(pushed).toEqual(loaded)
  expect(pushed.ok).toBe(false)

  const okArtifact = app("1.0.0", { runtimes: ["browser"] })
  expect(assessBundleForMachine(okArtifact, capability)).toEqual(assessBundleCompat(okArtifact, { abi: "effect-2", runtime: "browser" }))
})

test("a machine that declares nothing is adjudicated with the SDK's own defaults", () => {
  const capability = machineCapability(machine(["claude"]))
  expect(capability).toEqual({})
  expect(assessBundleForMachine(app("1.0.0"), capability).ok).toBe(true)
  // …and therefore refuses what the default host would refuse.
  expect(assessBundleForMachine(app("1.0.0", { runtimes: ["sandbox"] }), capability).ok).toBe(false)
})

test("a typo'd runtime capability fails loud instead of falling back to os", () => {
  expect(() => machineCapability(machine(["runtime:brower"]))).toThrow(/unknown runtime "brower"/)
})

test("the two ABI lines cannot be conflated at publish time", () => {
  const control = makeAgentdControl()
  control.registerMachine(machine()); control.registerAgent(agent)
  expect(() => control.publishBundle({ bundleId: "k", version: "1.0.0", abi: KERNEL_ABI, kind: "kernel" })).toThrow(/must declare bootstrapAbi/)
  expect(() => control.publishBundle(app("1.0.0", { bootstrapAbi: BOOTSTRAP_ABI }))).toThrow(/app bundle must not declare bootstrapAbi/)
})

test("binding an older version is a plain binding change — rollback needs no new mechanism", async () => {
  const control = makeAgentdControl()
  control.registerMachine(machine()); control.registerAgent(agent)
  control.publishBundle(app("0.13.0")); control.publishBundle(app("1.0.0"))
  control.bindBundles("a1", ["board@1.0.0"])
  const { applied: forward } = await push(control)
  expect(forward.artifacts[0].version).toBe("1.0.0")

  control.bindBundles("a1", ["board@0.13.0"])
  const adapter = makeBundleArtifactAdapter()
  const plan = adapter.plan(agent, control.desired("a1"), forward)
  expect(plan.changes).toEqual(["install board@0.13.0 (app)", "remove board@1.0.0"])
  expect(plan.desired.artifacts[0].version).toBe("0.13.0")
})

test("the plan reports a diff a human can read, not just a new config", () => {
  const control = makeAgentdControl()
  control.registerMachine(machine()); control.registerAgent(agent)
  control.publishBundle(app("0.13.0")); control.publishBundle(kernel("1.0.0"))
  control.bindBundles("a1", ["board@0.13.0"])

  const adapter = makeBundleArtifactAdapter()
  const first = adapter.plan(agent, control.desired("a1"))
  expect(first.changes).toEqual(["install board@0.13.0 (app)"])

  control.bindBundles("a1", ["board@0.13.0", "io.effect-agent.kernel@1.0.0"])
  const next = adapter.plan(agent, control.desired("a1"), first.desired)
  expect(next.changes).toEqual(["install io.effect-agent.kernel@1.0.0 (kernel)"])
})

test("the adapter validates its own contract and refuses a plan it did not produce", async () => {
  const adapter = makeBundleArtifactAdapter()
  expect(adapter.kind).toBe("effect-bundle")
  // A kernel artifact must carry its bootstrap line; an app artifact must not.
  expect(() => adapter.validate({ artifacts: [{ bundleId: "k", version: "1", kind: "kernel", abi: KERNEL_ABI, runtimes: ["os"] }], metadata: { agentId: "a1", revision: 1 } })).toThrow(/bootstrapAbi/)
  expect(() => adapter.validate({ artifacts: [{ bundleId: "b", version: "1", kind: "app", abi: KERNEL_ABI, runtimes: ["os"], bootstrapAbi: BOOTSTRAP_ABI }], metadata: { agentId: "a1", revision: 1 } })).toThrow(/must not declare bootstrapAbi/)
  expect(() => adapter.validate({ artifacts: [{ bundleId: "b", version: "1", kind: "app", abi: KERNEL_ABI, runtimes: [] }], metadata: { agentId: "a1", revision: 1 } })).toThrow(/runtimes/)
  expect(() => adapter.validate({ artifacts: [{ bundleId: "b", version: "1", kind: "app", abi: KERNEL_ABI, runtimes: ["os"] }, { bundleId: "b", version: "1", kind: "app", abi: KERNEL_ABI, runtimes: ["os"] }], metadata: { agentId: "a1", revision: 1 } })).toThrow(/twice/)
  await expect(adapter.apply({ agentId: "a2", revision: 1, desired: { artifacts: [], metadata: { agentId: "a1", revision: 1 } }, changes: [] })).rejects.toThrow(/invalid adapter plan/)
})

test("a desired config naming no machine cannot be adjudicated, so it is refused", () => {
  const control = makeAgentdControl()
  control.registerMachine(machine()); control.registerAgent(agent)
  control.publishBundle(app("1.0.0")); control.bindBundles("a1", ["board@1.0.0"])
  const { machine: _machine, ...withoutMachine } = control.desired("a1")
  const adapter = makeBundleArtifactAdapter()
  expect(() => adapter.plan(agent, withoutMachine)).toThrow(/runtime and abi cannot be adjudicated/)
})

test("what agentd pushes is what the host can stage — no translation in between", async () => {
  const { makeKernelSupervisor, makeMemoryKernelRepo, kernelRevision: base } = await import("@effect-agent/effect-bundle")
  const control = makeAgentdControl()
  control.registerMachine(machine()); control.registerAgent(agent)
  control.publishBundle(kernel("2.0.0"))
  control.bindBundles("a1", ["io.effect-agent.kernel@2.0.0"])

  const { plan } = await push(control)
  const pushed = control.desired("a1").bundles![0]

  // The pushed artifact becomes a repo revision directly…
  const revision = kernelRevisionOf(pushed, 2, "/tmp/whatever")
  expect(revision).toMatchObject({ kernelId: "io.effect-agent.kernel", abi: KERNEL_ABI, bootstrapAbi: BOOTSTRAP_ABI, revision: 2 })

  // …and the supervisor's own gate accepts it against the host it was pushed to.
  const loads: string[] = []
  const supervisor = makeKernelSupervisor<string>({
    repo: makeMemoryKernelRepo(),
    load: async (candidate) => { loads.push(`${candidate.kernelId}#${candidate.revision}`); return `${candidate.kernelId}#${candidate.revision}` },
    activate: () => {}, dispose: async () => {}, probe: async () => {},
    apps: () => [], host: { abi: KERNEL_ABI, bootstrapAbi: BOOTSTRAP_ABI, runtime: "os" },
  })
  await supervisor.boot(base({ kernelId: "io.effect-agent.kernel", abi: KERNEL_ABI, bootstrapAbi: BOOTSTRAP_ABI }, 1, "/tmp/first"))
  const staged = await supervisor.stage(revision)
  expect(staged.ok).toBe(true)
  expect(loads).toEqual(["io.effect-agent.kernel#1", "io.effect-agent.kernel#2"])
  expect(supervisor.state().active?.revision).toBe(2)
  expect(supervisor.state().previous?.revision).toBe(1)

  // The plan and the stage describe the same artifact.
  expect(plan.desired.artifacts[0]).toMatchObject({ bundleId: revision.kernelId, version: "2.0.0", bootstrapAbi: revision.bootstrapAbi })
})

test("only a kernel artifact can be staged; an app is refused with a clear reason", () => {
  expect(() => kernelRevisionOf(app("1.0.0"), 1)).toThrow(/is not a kernel artifact/)
})
