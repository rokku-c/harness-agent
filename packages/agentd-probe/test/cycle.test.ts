import { expect, test } from "bun:test"
import { makeNodeControl, runCycle, type ProbeFault } from "../src/index.ts"
import { machine } from "./harness.ts"
import { fakePlane, type Plane } from "./plane.ts"

const controlFor = (plane: Plane) => makeNodeControl({ baseUrl: "http://control", fetch: plane.fetch })
const rejected = (run: Promise<unknown>): Promise<ProbeFault> =>
  run.then(() => { throw new Error("expected a fault") }, (error: unknown) => error as ProbeFault)

test("a first beat introduces itself, applies, and receipts what the machine returned", async () => {
  const plane = fakePlane()
  const outcome = await runCycle({
    machine, control: controlFor(plane), leased: false,
    apply: async (plan) => ({ ran: plan.desired.apps.length }),
  })
  expect(plane.calls).toEqual(["announce", "plan", "report"])
  expect(outcome).toEqual({ kind: "applied", revision: 1, changes: ["+ ops::board@1.0.0"] })
  expect(plane.receipts).toEqual([{ revision: 1, state: { ok: true, deployment: { ran: 0 } } }])
})

test("a lease already held is renewed rather than taken again", async () => {
  const plane = fakePlane()
  await runCycle({ machine, control: controlFor(plane), leased: true, apply: async () => "ok" })
  expect(plane.calls).toEqual(["heartbeat", "plan", "report"])
})

test("the revision already receipted is neither applied nor reported again", async () => {
  const plane = fakePlane()
  const outcome = await runCycle({
    machine, control: controlFor(plane), leased: true, reported: 1,
    apply: async () => { throw new Error("must not run") },
  })
  expect(plane.calls).toEqual(["heartbeat", "plan"])
  expect(outcome).toEqual({ kind: "in-sync", revision: 1 })
  expect(plane.receipts).toEqual([])
})

test("a moved revision is applied again, so the skip is a revision and not a done flag", async () => {
  const plane = fakePlane()
  const control = controlFor(plane)
  await runCycle({ machine, control, leased: true, reported: 1, apply: async () => "v1" })
  plane.revision = 2
  const outcome = await runCycle({ machine, control, leased: true, reported: 1, apply: async () => "v2" })
  expect(outcome).toEqual({ kind: "applied", revision: 2, changes: ["+ ops::board@1.0.0"] })
  expect(plane.receipts.at(-1)).toEqual({ revision: 2, state: { ok: true, deployment: "v2" } })
})

test("an apply that throws still leaves a receipt saying so", async () => {
  const plane = fakePlane()
  const outcome = await runCycle({
    machine, control: controlFor(plane), leased: false,
    apply: async () => { throw new Error("disk full") },
  })
  expect(outcome).toEqual({ kind: "apply-failed", revision: 1, error: "disk full" })
  expect(plane.receipts).toEqual([{ revision: 1, state: { ok: false, error: "disk full" } }])
})

test("a stale receipt is reported rather than swallowed, and is not an `applied`", async () => {
  const plane = fakePlane({ report: 409 })
  let applied = 0
  const fault = await rejected(runCycle({
    machine, control: controlFor(plane), leased: true,
    apply: async () => { applied += 1; return "v1" },
  }))
  // The deployment moved under us while we were applying. Being overtaken is not
  // failure — but it is also not an applied deployment, and the beat must not end
  // pretending otherwise just because the local apply succeeded.
  expect(fault.kind).toBe("stale")
  expect(fault.status).toBe(409)
  expect(applied).toBe(1)
  expect(plane.calls).toEqual(["heartbeat", "plan", "report"])
})

test("a refused plan is never applied and never receipted", async () => {
  const plane = fakePlane({ plan: 400 })
  let applied = 0
  const fault = await rejected(runCycle({
    machine, control: controlFor(plane), leased: true,
    apply: async () => { applied += 1 },
  }))
  expect(fault.kind).toBe("plan")
  expect(applied).toBe(0)
  expect(plane.receipts).toEqual([])
  expect(plane.calls).toEqual(["heartbeat", "plan"])
})
