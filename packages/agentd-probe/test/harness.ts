import type { DeclaredMachine } from "@effect-agent/agentd"
import { startProbe, type CycleOutcome, type ProbeFault, type ProbeOptions } from "../src/index.ts"
import type { Plane } from "./plane.ts"

export const machine: DeclaredMachine = { machineId: "m1", name: "m1", status: "online", capabilities: ["os"], namespaces: ["ops"] }

/**
 * Drives the loop by hand instead of waiting on a timer, so a test observes the
 * state between beats. `startProbe` beats immediately, so the first `settled()`
 * is the first beat; `next()` then starts the following one. A loop that stopped
 * itself — the refusal case — schedules nothing, so `next()` would never resolve
 * and a test asserts on `pending` being empty instead of calling it.
 */
export const harness = (plane: Plane, overrides: Partial<ProbeOptions> = {}) => {
  const pending: Array<() => void> = [], events: Array<CycleOutcome | ProbeFault> = []
  let notify: (() => void) | undefined
  const probe = startProbe({
    url: "http://control", machine, fetch: plane.fetch, ...overrides,
    schedule: (run) => { pending.push(run); return () => { pending.splice(pending.indexOf(run), 1) } },
    onEvent: (event) => { events.push(event); notify?.(); notify = undefined },
  })
  const settled = (): Promise<void> => new Promise((resolve) => { notify = resolve })
  return {
    probe, events, pending, settled,
    next: async (): Promise<void> => { const wait = settled(); pending.shift()?.(); await wait },
  }
}
