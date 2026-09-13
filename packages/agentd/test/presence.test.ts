/**
 * §8.5-1's lease, on its own (docs/architecture-rework.md §8.5-1). The control
 * plane's use of it — that a *declared* machine is not a running one, and that
 * liveness never invalidates a receipt — is `nodes.test.ts`'s business.
 */

import { expect, test } from "bun:test"
import { makeNodePresence } from "../src/index.ts"

/** A clock a test can push, so "the lease expired" is an assertion, not a sleep. */
const clockAt = (start = 1_000_000) => {
  let wall = start, mono = 0
  return {
    clock: { now: () => wall, monotonic: () => mono },
    /** Time passing, as both readings agree it did. */
    advance(ms: number) { wall += ms; mono += ms },
    /** The wall clock moving on its own — an NTP step, not elapsed time. */
    stepWall(ms: number) { wall += ms },
    wall: () => wall,
  }
}

const TTL = 30_000

test("an announce is online and says since when", () => {
  const c = clockAt()
  const presence = makeNodePresence({ leaseTtlMs: TTL, clock: c.clock })

  const announced = presence.announce("node-1")

  expect(announced).toEqual({
    nodeId: "node-1", online: true, lastSeen: c.wall(), presentSince: c.wall(), ageMs: 0, withdrawn: false,
  })
})

test("a node that never announced has no presence — not an offline one", () => {
  const c = clockAt()
  const presence = makeNodePresence({ leaseTtlMs: TTL, clock: c.clock })

  expect(presence.presence("node-1")).toBeUndefined()
  expect(presence.heartbeat("node-1")).toBeUndefined()   // nothing to renew
  expect(presence.withdraw("node-1")).toBeUndefined()    // nothing to end
  expect(presence.list()).toEqual([])
})

test("the lease expires by itself, with no sweep and no sleep", () => {
  const c = clockAt()
  const presence = makeNodePresence({ leaseTtlMs: TTL, clock: c.clock })
  presence.announce("node-1")

  c.advance(TTL + 1)

  // Read-only, and it is already offline: expiry is derived, so there is no
  // background timer that could fail to run in a paused or sandboxed host.
  expect(presence.presence("node-1")).toMatchObject({ online: false, ageMs: TTL + 1 })
  expect(presence.list().map((node) => node.online)).toEqual([false])
})

test("the boundary is the TTL itself", () => {
  const c = clockAt()
  const presence = makeNodePresence({ leaseTtlMs: TTL, clock: c.clock })
  presence.announce("node-1")

  c.advance(TTL - 1)
  expect(presence.presence("node-1")?.online).toBe(true)
  c.advance(1)   // age == ttlMs exactly
  expect(presence.presence("node-1")?.online).toBe(false)
})

test("a heartbeat renews the presence it is renewing, rather than starting a second one", () => {
  const c = clockAt()
  const presence = makeNodePresence({ leaseTtlMs: TTL, clock: c.clock })
  const announced = presence.announce("node-1")

  c.advance(TTL - 1)
  const beaten = presence.heartbeat("node-1")

  expect(beaten?.online).toBe(true)
  expect(beaten?.ageMs).toBe(0)
  // "Up since" is unchanged: this is one continuous presence, which is exactly
  // what a node restarting inside its lease must not be able to reset.
  expect(beaten?.presentSince).toBe(announced.presentSince)
  expect(beaten?.lastSeen).toBe(c.wall())
})

test("a lapsed presence does not come back as a continuation of itself", () => {
  const c = clockAt()
  const presence = makeNodePresence({ leaseTtlMs: TTL, clock: c.clock })
  const announced = presence.announce("node-1")

  c.advance(TTL + 60_000)                     // gone for a minute
  expect(presence.heartbeat("node-1")?.online).toBe(true)   // it was alive all along, we just could not hear it
  const back = presence.presence("node-1")

  // ...but "up since" must not claim the minute it was missing. An uptime that
  // counts outages is worse than no uptime.
  expect(back?.presentSince).toBeGreaterThan(announced.presentSince!)
  expect(back?.presentSince).toBe(c.wall())
})

test("withdraw ends a presence at once, and a hello is required to come back", () => {
  const c = clockAt()
  const presence = makeNodePresence({ leaseTtlMs: TTL, clock: c.clock })
  presence.announce("node-1")

  const gone = presence.withdraw("node-1")

  // No clock advance: a clean shutdown is not a lease that ran out.
  expect(gone).toMatchObject({ online: false, withdrawn: true, lastSeen: c.wall() })
  expect(gone?.presentSince).toBeUndefined()
  // A nudge from a node that said goodbye is not a renew — it has to say hello.
  expect(presence.heartbeat("node-1")).toBeUndefined()
  expect(presence.presence("node-1")?.online).toBe(false)

  const returned = presence.announce("node-1")
  expect(returned).toMatchObject({ online: true, withdrawn: false, presentSince: c.wall() })
})

test("a wall clock stepped backwards cannot keep a dead lease alive", () => {
  const c = clockAt()
  const presence = makeNodePresence({ leaseTtlMs: TTL, clock: c.clock })
  presence.announce("node-1")
  c.advance(TTL + 1)                       // the node is now gone
  c.stepWall(-(TTL + 1 + 3_600_000))       // ...and NTP moves the wall clock back an hour

  // Wall age is now negative (clamped to 0) while the node has really been
  // silent for TTL+1 ms. Measured on the wall clock alone this reads as online,
  // and a dead node would hold its lease for however long the step was; the
  // monotonic reading is what stops the clock moving backwards from resurrecting it.
  expect(presence.presence("node-1")).toMatchObject({ online: false, ageMs: TTL + 1 })
})

test("each node's lease is its own", () => {
  const c = clockAt()
  const presence = makeNodePresence({ leaseTtlMs: TTL, clock: c.clock })
  presence.announce("node-1")
  c.advance(TTL + 1)
  presence.announce("node-2")

  expect(presence.list().map((node) => [node.nodeId, node.online])).toEqual([["node-1", false], ["node-2", true]])
  expect(presence.presence("node-2")?.presentSince).toBe(c.wall())
})
