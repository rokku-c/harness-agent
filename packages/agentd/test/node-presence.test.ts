/**
 * §8.5-1 at the control plane: node registration, heartbeat and lease, and the
 * two seams they touch — the desired set (§8.4) and the receipt revision (§9).
 *
 * The lease mechanism itself is `presence.test.ts`; what is asserted here is
 * everything that only becomes visible once a node has a *deployment*: that
 * falling off the network does not throw the deployment away, that renewing a
 * lease is not a desired-state change, and that a declaration which really did
 * change is one.
 */

import { expect, test } from "bun:test"
import { BOOTSTRAP_ABI, KERNEL_ABI } from "@effect-agent/effect-bundle"
import {
  AgentdError, makeAgentdControl, same, type BundleRef, type DeclaredMachine, type Machine, type NodeAppPlacement,
} from "../src/index.ts"

const TTL = 30_000

const clockAt = (start = 1_000_000) => {
  let wall = start, mono = 0
  return {
    clock: { now: () => wall, monotonic: () => mono },
    advance(ms: number) { wall += ms; mono += ms },
    wall: () => wall,
  }
}

/** What a node declares about itself — note there is no `reportedAt` to fill in. */
const declared = (capabilities: readonly string[], machineId = "node-1", namespaces: readonly string[] = ["ops"]): DeclaredMachine =>
  ({ machineId, name: "container", status: "online", capabilities, namespaces })
const osNode = () => declared(["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"])
/** The same machine as a *config* record, which does carry one. */
const configured = (capabilities: readonly string[]): Machine =>
  ({ ...declared(capabilities), reportedAt: 1 })

const kernel = (version: string): BundleRef =>
  ({ bundleId: "io.effect-agent.kernel", version, abi: KERNEL_ABI, bootstrapAbi: BOOTSTRAP_ABI, kind: "kernel" })
const app = (version: string): BundleRef => ({ bundleId: "board", version, abi: KERNEL_ABI })
const place = (bundle: BundleRef, ns: string): NodeAppPlacement =>
  ({ bundleId: bundle.bundleId, version: bundle.version, ns })

test("a machine declared in configuration is offline until it announces", () => {
  const c = clockAt()
  const control = makeAgentdControl({ leaseTtlMs: TTL, clock: c.clock })
  // The config seed path: the operator says this machine exists.
  control.registerMachine(configured(["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"]))

  // Declaring a machine is not running one. There is no `static` lease here as
  // there is for code-registered MCP servers, because "it is in the config file"
  // is exactly the claim §8.5-1 exists to stop treating as liveness.
  expect(control.nodePresence("node-1")).toEqual({ nodeId: "node-1", online: false, withdrawn: false })

  const announced = control.announceNode(osNode())

  expect(announced).toMatchObject({ nodeId: "node-1", online: true, presentSince: c.wall() })
  expect(control.nodeLiveness().nodes).toMatchObject([{ nodeId: "node-1", online: true }])
})

test("a lease that runs out takes the node offline and leaves its deployment alone", () => {
  const c = clockAt()
  const control = makeAgentdControl({ leaseTtlMs: TTL, clock: c.clock })
  control.registerMachine(configured(["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"]))
  control.publishBundle(kernel("1.0.0"))
  control.publishBundle(app("1.0.0"))
  control.bindNode("node-1", "io.effect-agent.kernel@1.0.0", [place(app("1.0.0"), "ops")])
  control.announceNode(osNode())
  const whileUp = control.desiredNode("node-1")

  c.advance(TTL + 1)

  expect(control.nodePresence("node-1")).toMatchObject({ online: false, ageMs: TTL + 1 })
  // Expiry is not deletion: the desired set *is* the recovery source (§8.4), so a
  // missed heartbeat must not be allowed to destroy the thing it recovers from.
  expect(same(whileUp, control.desiredNode("node-1"))).toBe(true)
  expect(control.desiredNode("node-1").apps.map((held) => held.ns)).toEqual(["ops"])
})

test("a heartbeat does not invalidate a receipt; a changed declaration does", () => {
  const c = clockAt()
  const control = makeAgentdControl({ leaseTtlMs: TTL, clock: c.clock })
  control.registerMachine(configured(["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"]))
  control.registerAgent({ agentId: "agent-1", machineId: "node-1", kind: "worker", version: "1.0.0", status: "online" })
  control.announceNode(osNode())
  // An agent with no binding is measured against the control plane's own
  // revision, so anything that bumps it goes stale against this receipt.
  const inFlight = control.desired("agent-1").revision

  c.advance(1_000)
  control.heartbeatNode("node-1")
  control.announceNode(osNode())   // a node restarting inside its lease

  expect(control.reportApplied("agent-1", inFlight, { ok: true }).revision).toBe(inFlight)

  // A node that comes back able to run *different* things is not the same
  // statement, and it is a desired-state change like any other.
  control.announceNode(declared(["abi:effect-1", "bootstrap:bootstrap-1", "runtime:browser"]))
  expect(() => control.reportApplied("agent-1", inFlight, { ok: true })).toThrow(/stale agent revision/)
})

test("a node restarting inside its lease keeps one identity, not two", () => {
  const c = clockAt()
  const control = makeAgentdControl({ leaseTtlMs: TTL, clock: c.clock })
  const first = control.announceNode(osNode())

  c.advance(TTL - 1)
  const again = control.announceNode(osNode())

  // One node, still up, and "up since" is the *first* hello: a process restart
  // is not a fleet change.
  expect(control.nodeLiveness().nodes).toHaveLength(1)
  expect(again).toMatchObject({ online: true, presentSince: first.presentSince })
  expect(again.lastSeen).toBe(c.wall())
})

test("withdraw ends the presence, not the node", () => {
  const c = clockAt()
  const control = makeAgentdControl({ leaseTtlMs: TTL, clock: c.clock })
  control.registerMachine(configured(["abi:effect-1", "bootstrap:bootstrap-1", "runtime:os"]))
  control.publishBundle(app("1.0.0"))
  control.bindNode("node-1", undefined, [place(app("1.0.0"), "ops")])
  control.announceNode(osNode())

  const gone = control.withdrawNode("node-1")

  expect(gone).toMatchObject({ online: false, withdrawn: true })
  // A node that shut down cleanly is still the node we will hand its deployment
  // to when it comes back — a graceful stop is not a decommission.
  expect(control.nodePresence("node-1").withdrawn).toBe(true)
  expect(control.desiredNode("node-1").apps).toHaveLength(1)
  // ...and it has to say hello again, not merely nudge.
  expect(() => control.heartbeatNode("node-1")).toThrow(/announce first/)
})

test("reading the presence of a node that does not exist is a 404, not an empty answer", () => {
  const control = makeAgentdControl()

  expect(() => control.nodePresence("node-9")).toThrow(AgentdError)
  expect(() => control.nodePresence("node-9")).toThrow(/node not found/)
})

test("the announce stamps reportedAt from the server's clock — the caller has no field for it", () => {
  const c = clockAt()
  const control = makeAgentdControl({ leaseTtlMs: TTL, clock: c.clock })

  control.announceNode(osNode())

  // `DeclaredMachine` has no `reportedAt`, so this is not merely overwritten: a
  // node cannot state a "when I was seen" that the server would then have to
  // decide whether to believe.
  expect((control.status() as { machines: Machine[] }).machines[0].reportedAt).toBe(c.wall())
})

test("liveness verbs are open until a token is configured, and then they are not", () => {
  const open = makeAgentdControl()
  open.announceNode(osNode())
  expect(open.heartbeatNode("node-1").online).toBe(true)
  // Stated, not implied: an unarmed guard and an armed one are indistinguishable
  // from the outside until one of them returns a 401.
  expect(open.nodeLiveness().tokenRequired).toBe(false)

  const guarded = makeAgentdControl({ nodeToken: "fleet-secret" })
  guarded.announceNode(osNode(), "fleet-secret")

  expect(guarded.nodeLiveness().tokenRequired).toBe(true)
  expect(() => guarded.announceNode(declared([], "node-2"))).toThrow(/unauthorized node node-2/)
  expect(() => guarded.heartbeatNode("node-1", "wrong")).toThrow(AgentdError)
  expect(() => guarded.withdrawNode("node-1", "wrong")).toThrow(AgentdError)
  expect(guarded.heartbeatNode("node-1", "fleet-secret").online).toBe(true)
  // A refused verb must not have half-worked.
  expect(guarded.nodePresence("node-1").online).toBe(true)
})
