/**
 * The route dispatch point of docs/architecture-rework.md §6.1/§6.2, with the
 * switch-window request protection of §6.5-5.
 *
 * §6.2's double buffer only works if the flip is a *pointer assignment* and the
 * displaced implementation is not stopped while it is still answering. Both
 * halves live here:
 *
 *   activate(B)   ── one assignment; A keeps serving the requests already inside it
 *   run(request)  ── captures the current target ONCE, counts it, releases after
 *   retire(A)     ── waits for A's in-flight requests to finish; refuses to touch
 *                    the active target, because that is the one thing §6.2 forbids
 *
 * Without the counting, "commit then stop A" still cuts off in-flight requests on
 * A — the window would just be smaller, not closed. Without the refusal, a
 * careless caller could stop the kernel that is currently serving.
 *
 * This module is deliberately about targets and requests only: it does not know
 * what a kernel is, how one is loaded, or what compatibility means.
 */

/**
 * Anything that can sit behind the dispatch point. Only `id` is required: the
 * point counts and retires, it does not know how a target answers — that is the
 * work function's business (`run`).
 */
export interface DispatchTarget {
  /** Stable name for logs, events and error messages. */
  readonly id: string
}

export interface DispatchStats {
  readonly id: string
  readonly inFlight: number
  readonly active: boolean
}

export interface DispatchPoint<T extends DispatchTarget> {
  /**
   * Point the dispatcher at `next`. One assignment; nothing is stopped here.
   * `undefined` means nothing is active — requests get a 503 instead of a crash.
   */
  activate(next: T | undefined): void
  current(): T | undefined
  /** Every target still being tracked, with its in-flight request count. */
  stats(): readonly DispatchStats[]
  inFlight(target?: T): number
  /**
   * Run one request against the target that is current *now*. A request that
   * entered before a flip finishes on the old target; `retire` waits for it.
   */
  run(work: (target: T) => Promise<Response>): Promise<Response>
  /**
   * Wait until `target` has no requests in flight. Refuses the active target:
   * flip first, then retire (§6.2 — A is never stopped before the commit).
   */
  retire(target: T): Promise<void>
}

export const makeDispatchPoint = <T extends DispatchTarget>(): DispatchPoint<T> => {
  let current: T | undefined
  const counts = new Map<T, number>()
  const draining = new Map<T, Array<() => void>>()

  const release = (target: T): void => {
    const next = (counts.get(target) ?? 1) - 1
    counts.set(target, next)
    if (next > 0) return
    const waiters = draining.get(target)
    if (waiters === undefined) return
    draining.delete(target)
    for (const resume of waiters) resume()
  }

  const acquire = (target: T): void => { counts.set(target, (counts.get(target) ?? 0) + 1) }

  return {
    activate: (next) => { current = next },
    current: () => current,
    inFlight: (target) => target === undefined
      ? [...counts.values()].reduce((sum, n) => sum + n, 0)
      : counts.get(target) ?? 0,
    stats: () => {
      const tracked = [...counts].map(([target, inFlight]) => ({ id: target.id, inFlight, active: target === current }))
      // A freshly activated target has no requests yet — still worth naming, and
      // `retire` tracking must not be confused with "was never activated".
      return current !== undefined && !counts.has(current)
        ? [...tracked, { id: current.id, inFlight: 0, active: true }]
        : tracked
    },
    run: async (work) => {
      const target = current
      if (target === undefined) {
        return Response.json({ ok: false, detail: "no kernel is active" }, { status: 503 })
      }
      acquire(target)
      try {
        return await work(target)
      } finally {
        release(target)
      }
    },
    retire: async (target) => {
      if (target === current) {
        throw new Error(`effect-host: refusing to retire the active target ${target.id}; activate the successor first`)
      }
      if ((counts.get(target) ?? 0) === 0) return
      await new Promise<void>((resume) => {
        const waiters = draining.get(target)
        if (waiters === undefined) draining.set(target, [resume])
        else waiters.push(resume)
      })
    },
  }
}
