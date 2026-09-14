export interface InFlight<T> {
  acquire(target: T): void
  release(target: T): void
  inFlight(target?: T): number
  entries(): ReadonlyArray<readonly [T, number]>
  tracks(target: T): boolean
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
