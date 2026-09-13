import { expect, test } from "bun:test"
import type { ProbeFault } from "../src/index.ts"
import { harness } from "./harness.ts"
import { fakePlane } from "./plane.ts"

const rejected = (run: Promise<unknown>): Promise<ProbeFault> =>
  run.then(() => { throw new Error("expected a fault") }, (error: unknown) => error as ProbeFault)

test("stop says goodbye, and says it once", async () => {
  const plane = fakePlane()
  const { probe, pending, settled } = harness(plane)
  await settled()
  await Promise.all([probe.stop(), probe.stop()])
  expect(plane.calls.filter((verb) => verb === "withdraw")).toHaveLength(1)
  expect(probe.status().leased).toBe(false)
  // And the loop is over: nothing is left scheduled to beat after the goodbye.
  expect(pending).toHaveLength(0)
})

test("a goodbye that could not be delivered is a failure, not a clean exit", async () => {
  const plane = fakePlane({ withdraw: "unreachable" })
  const { probe, settled } = harness(plane)
  await settled()
  const fault = await rejected(probe.stop())
  expect(fault.kind).toBe("unreachable")
  expect(fault.message).toContain("withdraw")
  // Retrying the goodbye is the caller's business, not a second withdraw: the
  // first one was never answered, so sending another would be asking twice.
  await rejected(probe.stop())
  expect(plane.calls.filter((verb) => verb === "withdraw")).toHaveLength(1)
})
