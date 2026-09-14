import { makeInFlight } from "./dispatch-counts.ts"

export interface DispatchTarget {
  readonly id: string
}

export interface DispatchStats {
  readonly id: string
  readonly inFlight: number
  readonly active: boolean
}

export interface DispatchPoint<T extends DispatchTarget> {
  activate(next: T | undefined): void
  current(): T | undefined
  stats(): readonly DispatchStats[]
  inFlight(target?: T): number
  run(work: (target: T) => Promise<Response>): Promise<Response>
  retire(target: T): Promise<void>
}

export const makeDispatchPoint = <T extends DispatchTarget>(): DispatchPoint<T> => {
  let current: T | undefined
  const flight = makeInFlight<T>()

  return {
    activate: (next) => { current = next },
    current: () => current,
    inFlight: (target) => flight.inFlight(target),
    stats: () => {
      const tracked = flight.entries()
        .map(([target, count]) => ({ id: target.id, inFlight: count, active: target === current }))
      return current !== undefined && !flight.tracks(current)
        ? [...tracked, { id: current.id, inFlight: 0, active: true }]
        : tracked
    },
    run: async (work) => {
      const target = current
      if (target === undefined) {
        return Response.json({ ok: false, detail: "no kernel is active" }, { status: 503 })
      }
      flight.acquire(target)
      try {
        return await work(target)
      } finally {
        flight.release(target)
      }
    },
    retire: async (target) => {
      if (target === current) {
        throw new Error(`effect-host: refusing to retire the active target ${target.id}; activate the successor first`)
      }
      await flight.drained(target)
    },
  }
}
