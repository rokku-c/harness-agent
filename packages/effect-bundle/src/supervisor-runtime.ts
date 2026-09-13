/**
 * The supervisor's running memory: the recorded index, the revisions this host
 * has already refused, and the two slots the double buffer moves between.
 *
 * Every disposition shares these, so an ordering (supervisor-swap.ts,
 * supervisor-rebuild.ts) and the state it orders cannot drift apart.
 */
import { assessKernelCompat, type BootstrapCapability } from "./kernel.ts"
import { assessKernelAgainst, type DeclaredApp } from "./kernel-matrix.ts"
import type { KernelRepo, KernelRevision, KernelState } from "./repo.ts"
import type { SupervisorEvent } from "./supervisor-events.ts"
import type { KernelSlot, Refusal } from "./supervisor-outcome.ts"
import type { SupervisorOptions } from "./supervisor-types.ts"

export interface KernelRuntime<K> {
  readonly options: SupervisorOptions<K>
  emit(event: SupervisorEvent): void
  state(): KernelState
  persist(next: KernelState): void
  condemned(): readonly number[]
  condemn(revision: KernelRevision): void
  /** Both halves of the §5 judgement, or undefined when the revision may run. */
  refusalFor(revision: KernelRevision): Refusal | undefined
  /** Load + health-check a revision. Nothing is flipped yet; on failure it is dropped. */
  adopt(revision: KernelRevision): Promise<KernelSlot<K>>
  /**
   * Put a candidate in front and hand back the slot it displaced. The in-memory
   * half of §6.2's commit: the caller still has to record it, and the displaced
   * kernel is stopped only after that record exists.
   */
  promote(slot: KernelSlot<K>): KernelSlot<K> | undefined
  active(): KernelSlot<K> | undefined
  previous(): KernelSlot<K> | undefined
}

export const makeKernelRuntime = <K>(options: SupervisorOptions<K>): KernelRuntime<K> => {
  let state: KernelState = options.repo.read()
  let live: KernelSlot<K> | undefined
  let prior: KernelSlot<K> | undefined

  const emit = (event: SupervisorEvent): void => options.onEvent?.(event)

  const persist = (next: KernelState): void => {
    state = next
    options.repo.write(next)
  }

  const condemned = (): readonly number[] => state.condemned ?? []

  const condemn = (revision: KernelRevision): void => {
    if (condemned().includes(revision.revision)) return
    persist({ ...state, condemned: [...condemned(), revision.revision] })
  }

  const refusalFor = (revision: KernelRevision): Refusal | undefined => {
    const verdict = assessKernelCompat(revision, options.host)
    if (!verdict.ok) return { kind: "incompatible", reason: verdict.reason }
    const broken = assessKernelAgainst(revision, options.apps?.() ?? [], options.host)
    return broken.length === 0 ? undefined : { kind: "apps", broken }
  }

  const adopt = async (revision: KernelRevision): Promise<KernelSlot<K>> => {
    const kernel = await options.load(revision)
    const slot: KernelSlot<K> = {
      revision,
      kernel,
      dispose: async () => { await options.dispose?.(kernel) },
    }
    if (options.probe !== undefined) {
      try {
        await options.probe(slot)
      } catch (error) {
        await slot.dispose()
        throw error
      }
    }
    return slot
  }

  const promote = (slot: KernelSlot<K>): KernelSlot<K> | undefined => {
    const displaced = live
    live = slot
    prior = displaced
    return displaced
  }

  return {
    options,
    emit,
    state: () => state,
    persist,
    condemned,
    condemn,
    refusalFor,
    adopt,
    promote,
    active: () => live, previous: () => prior,
  }
}

