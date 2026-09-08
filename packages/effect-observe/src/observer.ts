/**
 * startObserver: each tick samples the configured perspectives for a target
 * and records a frame only when the world state an observer would read
 * CHANGES. The first tick records a baseline per perspective and returns it;
 * later ticks return null while every sampled state is unchanged.
 */
import { jsonHash, type ObservationSnapshot, type Perspective, type Sampler } from "./types.ts"
import type { ObservationStore } from "./store.ts"

export interface ObserverOptions {
  store: ObservationStore
  sampler: Sampler
  target: string
  perspectives?: Perspective[]
  intervalMs: number
  /** Change-detection hash override; defaults to stable jsonHash. */
  hashOf?: (data: unknown) => string
}

export interface Observer {
  stop(): void
  tick(): Promise<ObservationSnapshot | null>
}

const DEFAULT_PERSPECTIVES: readonly Perspective[] = ["app", "agent", "global"]

export const startObserver = (options: ObserverOptions): Observer => {
  const { store, sampler, target, intervalMs } = options
  const perspectives = options.perspectives ?? [...DEFAULT_PERSPECTIVES]
  const hashOf = options.hashOf ?? jsonHash
  const lastSeen = new Map<Perspective, string>()

  const tick = async (): Promise<ObservationSnapshot | null> => {
    let recorded: ObservationSnapshot | null = null
    for (const perspective of perspectives) {
      const data = await sampler(perspective, target)
      const hash = hashOf(data)
      const previous = lastSeen.get(perspective)
      if (previous !== hash) {
        lastSeen.set(perspective, hash)
        const snapshot: ObservationSnapshot = { at: Date.now(), perspective, target, data }
        store.record(snapshot)
        recorded = snapshot
      }
    }
    return recorded
  }

  const timer =
    intervalMs > 0 ? setInterval(() => { void tick().catch(() => {}) }, intervalMs) : undefined

  return {
    stop(): void {
      if (timer !== undefined) clearInterval(timer)
    },
    tick,
  }
}
