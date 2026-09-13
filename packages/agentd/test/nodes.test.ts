/**
 * §8.4: the deployment unit is a node's whole app set, not one artifact for one
 * agent.
 *
 * The properties worth testing are the ones that only exist once artifacts come
 * in a *set*: a failure has to name the placement that failed (a set with twelve
 * entries cannot answer "the plan failed"), and one artifact placed twice at two
 * namespaces is legal while the same address twice is not. The adjudication
 * itself is deliberately not re-tested here — it is `assessBundleForMachine`'s,
 * and re-asserting it would be asserting that a call happened.
 */

import { expect, test } from "bun:test"
import { BOOTSTRAP_ABI, KERNEL_ABI } from "@effect-agent/effect-bundle"
import {
  AgentdError, makeAgentdControl, makeNodeArtifactAdapter, nodeAppId, requirableRuntimes,
  type BundleRef, type Machine, type NodeAppPlacement,
} from "../src/index.ts"

const node = (capabilities: readonly string[] = [], namespaces: readonly string[] = ["ops", "workspace-b"]): Machine =>
  ({ machineId: "node-1", name: "container", status: "online", capabilities, namespaces, reportedAt: 1 })
const kernel = (version: string, over: Partial<BundleRef> = {}): BundleRef =>
  ({ bundleId: "io.effect-agent.kernel", version, abi: KERNEL_ABI, bootstrapAbi: BOOTSTRAP_ABI, kind: "kernel", ...over })
const app = (version: string, over: Partial<BundleRef> = {}): BundleRef =>
  ({ bundleId: "board", version, abi: KERNEL_ABI, ...over })
/** A placement names *where*, not *what* — the artifact's lines come from the registry. */
const place = (bundle: BundleRef, ns: string, over: Partial<NodeAppPlacement> = {}): NodeAppPlacement =>
  ({ bundleId: bundle.bundleId, version: bundle.version, ns, ...over })

/** A node with a kernel and two apps placed at two namespaces, as §8.1 shows. */
const setup = () => {
  const control = makeAgentdControl()
  control.registerMachine(node(["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"]))
  control.publishBundle(kernel("1.0.0"))
  control.publishBundle(app("1.0.0"))
  control.bindNode("node-1", "io.effect-agent.kernel@1.0.0", [
    place(app("1.0.0"), "ops"),
    place(app("1.0.0"), "workspace-b"),
  ])
  return control
}

test("a node is pushed a kernel and a set of apps in one plan, with one receipt", async () => {
  const control = setup()
  const adapter = makeNodeArtifactAdapter()
  const desired = control.desiredNode("node-1")
  const plan = adapter.plan(desired.node, desired)
  const applied = await adapter.apply(plan)

  expect(plan.revision).toBe(desired.revision)
  expect(applied.metadata).toEqual({ nodeId: "node-1", revision: desired.revision })
  expect(applied.kernel).toMatchObject({ bundleId: "io.effect-agent.kernel", kind: "kernel", bootstrapAbi: BOOTSTRAP_ABI })
  expect(applied.apps.map(nodeAppId)).toEqual(["ops::board@1.0.0", "workspace-b::board@1.0.0"])
  // The receipt goes back against that same revision, on the existing 409 rule.
  expect(control.reportNodeApplied("node-1", applied.metadata.revision, applied).revision).toBe(desired.revision)
})

test("one artifact placed at two namespaces is two placements, not a duplicate", async () => {
  const control = setup()
  const adapter = makeNodeArtifactAdapter()
  const applied = await adapter.apply(adapter.plan(node(), control.desiredNode("node-1")))

  // Same bytes, two addresses — the point of §8.1's `ops/board` vs `workspace-b/board`.
  expect(applied.apps).toHaveLength(2)
  const [ops, workspace] = applied.apps
  expect(ops!.bundleId).toBe(workspace!.bundleId)
  expect(ops!.version).toBe(workspace!.version)
  expect(new Set(applied.apps.map(nodeAppId)).size).toBe(2)

  // The same address twice, on the other hand, is a contradiction.
  expect(() => control.bindNode("node-1", undefined, [place(app("1.0.0"), "ops"), place(app("1.0.0"), "ops")]))
    .toThrow(/same app is placed twice at one namespace/)
})

test("a refusal names which placement failed, not just that the plan did", () => {
  const control = makeAgentdControl()
  // A node that is an OS host, and an app that declares it runs anywhere but.
  const browserOnly = app("1.0.0", { runtimes: ["browser"] })
  control.registerMachine(node(["abi:effect-1", "runtime:os"]))
  control.publishBundle(browserOnly)
  control.bindNode("node-1", undefined, [place(browserOnly, "ops"), place(browserOnly, "workspace-b")])

  const adapter = makeNodeArtifactAdapter()
  try {
    adapter.plan(node(["abi:effect-1", "runtime:os"]), control.desiredNode("node-1"))
    throw new Error("expected a refusal")
  } catch (error) {
    expect(error).toBeInstanceOf(AgentdError)
    const message = (error as Error).message
    // Both the address and the machine: with a set, "cannot push" is not enough.
    expect(message).toMatch(/cannot place ops::board@1\.0\.0 on node-1:/)
    expect(message).toMatch(/runtime/)
  }
})

test("the kernel slot and the app slots are not interchangeable", () => {
  const control = makeAgentdControl()
  control.registerMachine(node(["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"]))
  control.publishBundle(kernel("1.0.0")); control.publishBundle(app("1.0.0"))

  // A kernel is not an app placement...
  expect(() => control.bindNode("node-1", undefined, [place(kernel("1.0.0"), "ops")]))
    .toThrow(/is a kernel artifact; a node app placement must be an app/)
  // ...and an app is not a kernel.
  expect(() => control.bindNode("node-1", "board@1.0.0", []))
    .toThrow(/board@1\.0\.0 is not a kernel artifact/)
  // The adapter enforces the same split on the way back in.
  const adapter = makeNodeArtifactAdapter()
  expect(() => adapter.validate({ nodeId: "node-1", kernel: { bundleId: "board", version: "1", kind: "app", abi: KERNEL_ABI, runtimes: ["os"] }, apps: [], metadata: { nodeId: "node-1", revision: 1 } }))
    .toThrow(/kernel slot must hold a kernel artifact/)
})

test("a stale node receipt is refused with 409, like every other agentd receipt", () => {
  const control = setup()
  const stale = control.desiredNode("node-1").revision - 1
  try {
    control.reportNodeApplied("node-1", stale, {})
    throw new Error("expected a 409")
  } catch (error) {
    expect((error as AgentdError).status).toBe(409)
  }
  expect(() => control.desiredNode("nope")).toThrow(/node not found/)
})

test("the plan says what changed, addressed by placement", async () => {
  const control = setup()
  const adapter = makeNodeArtifactAdapter()
  const first = await adapter.apply(adapter.plan(node(), control.desiredNode("node-1")))
  expect(adapter.plan(node(), control.desiredNode("node-1")).changes)
    .toEqual(["install io.effect-agent.kernel@1.0.0 (kernel)", "place ops::board@1.0.0", "place workspace-b::board@1.0.0"])

  // Rolling one app back is a binding change — no second rollback mechanism.
  // Additions are listed before removals, the same order the artifact adapter uses.
  control.publishBundle(app("0.13.0"))
  control.bindNode("node-1", "io.effect-agent.kernel@1.0.0", [place(app("0.13.0"), "ops"), place(app("1.0.0"), "workspace-b")])
  expect(adapter.plan(node(), control.desiredNode("node-1"), first).changes)
    .toEqual(["place ops::board@0.13.0", "remove ops::board@1.0.0"])
})

test("a node's runtime requirement is the union over what it hosts", async () => {
  const control = makeAgentdControl()
  control.registerMachine(node(["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"]))
  control.publishBundle(kernel("1.0.0"))
  control.publishBundle(app("1.0.0", { runtimes: ["os", "browser"] }))
  control.bindNode("node-1", "io.effect-agent.kernel@1.0.0", [place(app("1.0.0", { runtimes: ["os", "browser"] }), "ops")])
  const adapter = makeNodeArtifactAdapter()
  const applied = await adapter.apply(adapter.plan(node(), control.desiredNode("node-1")))
  expect(requirableRuntimes(applied)).toEqual(["os", "browser"])
})
