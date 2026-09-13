/**
 * §8.3: what a node says it carries, adjudicated at its plan.
 *
 * The interesting property is not "a bad placement is refused" but *where* the
 * refusal happens. An announce overwrites a machine's declaration, so a node can
 * narrow what it carries after a binding exists; a gate at the registry write
 * would keep serving a deployment the node has since disowned. `node-admission`
 * in `apps/agentd` proves that over HTTP with a real announce. This file is the
 * rule itself: one artifact, one node, and the three reasons it may be refused.
 */

import { expect, test } from "bun:test"
import { KERNEL_ABI } from "@effect-agent/effect-bundle"
import {
  AgentdError, makeAgentdControl, makeNodeArtifactAdapter,
  type BundleRef, type Machine, type NodeAppPlacement,
} from "../src/index.ts"

const node = (namespaces: readonly string[], over: Partial<Machine> = {}): Machine =>
  ({
    machineId: "node-1", name: "container", status: "online",
    capabilities: [KERNEL_ABI, "runtime:os"], namespaces, reportedAt: 1, ...over,
  })
const place = (ns: string): NodeAppPlacement => ({ bundleId: "board", version: "1.0.0", ns })

/** The control plane as config would seed it, planned the way the adapter is asked. */
const seeded = (machine: Machine, placements: readonly NodeAppPlacement[]) => {
  const control = makeAgentdControl()
  control.registerMachine(machine)
  control.publishBundle({ bundleId: "board", version: "1.0.0", abi: KERNEL_ABI } satisfies BundleRef)
  control.bindNode("node-1", undefined, placements)
  return control
}
const plan = (machine: Machine, placements: readonly NodeAppPlacement[]) => {
  const desired = seeded(machine, placements).desiredNode("node-1")
  return makeNodeArtifactAdapter().plan(desired.node, desired)
}
const refusal = (machine: Machine, placements: readonly NodeAppPlacement[]): string => {
  try {
    plan(machine, placements)
    throw new Error("expected a refusal")
  } catch (error) {
    expect(error).toBeInstanceOf(AgentdError)
    return (error as Error).message
  }
}

test("a placement into a domain the node declared is admitted", () => {
  expect(plan(node(["ops", "workspace-b"]), [place("ops")]).changes).toEqual(["place ops::board@1.0.0"])
})

test("a placement into a domain the node never declared is refused, naming the domain", () => {
  // The refusal has to be actionable on its own: an operator reading "invalid
  // placement" cannot tell whether to fix the binding or the node's declaration.
  expect(refusal(node(["ops"]), [place("workspace-b")]))
    .toBe('node node-1 does not carry namespace "workspace-b" for board; it carries ops')
})

test("a node that declares no namespaces carries nothing", () => {
  // The allowlist default is *deny*. A permissive reading of an empty set would
  // make the field decoration for exactly the nodes nobody thought about.
  expect(refusal(node([]), [place("ops")])).toContain("it carries (none declared)")
  // Nothing placed at all is still fine — a node with no apps breaks no rule.
  expect(plan(node([]), []).changes).toEqual([])
})

test("a stated ceiling admits up to its number and refuses past it", () => {
  const two = [place("ops"), place("workspace-b")]
  expect(plan(node(["ops", "workspace-b"], { maxApps: 2 }), two).changes).toHaveLength(2)
  expect(refusal(node(["ops", "workspace-b"], { maxApps: 1 }), two))
    .toBe("node node-1 carries at most 1 apps; this deployment places 2")
  // Zero is a declaration like any other: a node draining itself takes no apps.
  expect(refusal(node(["ops"], { maxApps: 0 }), [place("ops")])).toContain("carries at most 0 apps")
})

test("stating no ceiling is not the same as stating zero", () => {
  // §11-Q17: the platform does not invent a number for a node that named none.
  const many = [place("ops"), place("workspace-b")]
  expect(plan(node(["ops", "workspace-b"]), many).changes).toHaveLength(2)
})

test("a refusal refuses; it does not half-write a deployment", () => {
  // A plan is a read plus a verdict: a refused placement leaves nothing behind,
  // so the node's next beat pulls the same state and gets the same answer.
  const control = seeded(node([]), [place("ops")])
  const before = control.desiredNode("node-1")
  expect(() => makeNodeArtifactAdapter().plan(before.node, before)).toThrow(/does not carry namespace/)
  expect(control.desiredNode("node-1")).toEqual(before)
})

test("what a node carries is adjudicated before what it can run", () => {
  // Both rules would refuse this deployment. The namespace one wins because it
  // needs no registry: a placement into a domain the node never claimed is
  // refused whether or not the artifact exists, and the message says so rather
  // than blaming a runtime the operator never touched.
  const misdeclared = node([], { capabilities: [KERNEL_ABI, "runtime:browser"] })
  const message = refusal(misdeclared, [place("ops")])
  expect(message).toContain("does not carry namespace")
  expect(message).not.toContain("runtime")
})
