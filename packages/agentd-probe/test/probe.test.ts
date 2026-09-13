import { expect, test } from "bun:test"
import { harness } from "./harness.ts"
import { fakePlane, type Rule, type Verb } from "./plane.ts"

test("a refusal is not retried: the loop stops and says what refused it", async () => {
  const plane = fakePlane({ announce: 401 })
  const { probe, pending, settled } = harness(plane)
  await settled()
  // Nothing is scheduled after a refusal, which is the whole point: the identical
  // call is refused identically forever, so beating again is a spin, not a retry.
  expect(pending).toHaveLength(0)
  expect(probe.status().halted?.kind).toBe("refused")
  expect(probe.status().beats).toBe(0)
  expect(probe.status().leased).toBe(false)
  expect(plane.calls).toEqual(["announce"])
})

test("an unreachable control plane is beaten again, and never counted as work done", async () => {
  const rules: Partial<Record<Verb, Rule>> = { announce: "unreachable", heartbeat: "unreachable" }
  const plane = fakePlane(rules)
  const { probe, settled, next } = harness(plane)
  await settled()
  expect(probe.status().fault?.kind).toBe("unreachable")
  expect(probe.status().beats).toBe(0)
  expect(probe.status().last).toBeUndefined()
  expect(probe.status().leased).toBe(false)
  expect(probe.status().halted).toBeUndefined()

  delete rules.announce
  delete rules.heartbeat
  await next()
  expect(probe.status().fault).toBeUndefined()
  expect(probe.status().beats).toBe(1)
  expect(probe.status().last?.kind).toBe("applied")
  expect(plane.calls).toEqual(["announce", "announce", "plan", "report"])
  await probe.stop()
})

test("a stale receipt keeps the loop going, because being overtaken is progress", async () => {
  const rules: Partial<Record<Verb, Rule>> = { report: 409 }
  const plane = fakePlane(rules)
  const { probe, settled, next } = harness(plane)
  await settled()
  expect(probe.status().fault?.kind).toBe("stale")
  expect(probe.status().beats).toBe(0)
  expect(probe.status().halted).toBeUndefined()

  delete rules.report
  await next()
  expect(probe.status().beats).toBe(1)
  expect(probe.status().last?.kind).toBe("applied")
  await probe.stop()
})

test("a lease that lapsed while we were away is taken again in the same beat", async () => {
  const plane = fakePlane({ heartbeat: 404 })
  const { probe, settled, next } = harness(plane)
  await settled()
  expect(plane.calls).toEqual(["announce", "plan", "report"])

  await next()
  // heartbeat → 404 "announce first" → announce, then carry on with the same beat
  // rather than spending a whole interval failing to say who we are. Taking the
  // lease again is not by itself a reason to re-apply: the revision did not move,
  // so this beat ends in-sync.
  expect(plane.calls).toEqual(["announce", "plan", "report", "heartbeat", "announce", "plan"])
  expect(probe.status().beats).toBe(2)
  expect(probe.status().last?.kind).toBe("in-sync")
  expect(probe.status().fault).toBeUndefined()
  expect(probe.status().leased).toBe(true)
  await probe.stop()
})
