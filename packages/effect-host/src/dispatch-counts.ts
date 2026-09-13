/**
 * In-flight accounting for the dispatch point (docs/architecture-rework.md
 * §6.5-5): how many requests each target is answering, and who waits for one to
 * drain.
 *
 * The counting is what closes the switch window — the flip is one assignment,
 * but a retired implementation is only safe to stop once nothing is still
 * inside it. A waiter is resumed by the release that takes the last request out,
 * so a retire is woken by the event itself and never polls or misses it.
 */
export interface InFlight<T> {
  acquire(target: T): void
  release(target: T): void
  /** Requests in flight on `target`, or on every target when it is omitted. */
  inFlight(target?: T): number
  /** Targets with a count, in acquisition order — a target at zero is forgotten. */
  entries(): ReadonlyArray<readonly [T, number]>
  /** Is this target being tracked at all? A fresh one is not. */
  tracks(target: T): boolean
  /** Resolve once `target` has no request in flight; already zero resolves at once. */
  drained(target: T): Promise<void>
}

export const makeInFlight = <T>(): InFlight<T> => {
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

  return {
    acquire: (target) => { counts.set(target, (counts.get(target) ?? 0) + 1) },
    release,
    inFlight: (target) => target === undefined
      ? [...counts.values()].reduce((sum, n) => sum + n, 0)
      : counts.get(target) ?? 0,
    entries: () => [...counts],
    tracks: (target) => counts.has(target),
    drained: (target) => (counts.get(target) ?? 0) === 0
      ? Promise.resolve()
      : new Promise<void>((resume) => {
          const waiters = draining.get(target)
          if (waiters === undefined) draining.set(target, [resume])
          else waiters.push(resume)
        }),
  }
}
