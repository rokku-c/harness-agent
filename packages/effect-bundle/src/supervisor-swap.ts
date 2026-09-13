/**
 * §6.3-①: the pure swap — the one way a kernel is replaced without touching the
 * apps.
 *
 *   stage B ─► health check ─► flip the dispatcher ─► persist(active=B, previous=A) ─► stop A
 *
 * The invariant that makes this different from "unload then load": **A is never
 * stopped before the flip is committed**. If anything fails up to that point, A
 * is still loaded and still in front, so recovery is not a rebuild — it is
 * simply *not having moved*. If the flip itself throws, A is put back in front;
 * it was never stopped, so putting it back cannot fail for a reason we created.
 */
import { messageOf } from "@effect-agent/effect-interface"
import type { KernelRevision } from "./repo.ts"
import { type KernelSlot, type StageResult } from "./supervisor-outcome.ts"
import type { KernelRuntime } from "./supervisor-runtime.ts"

export const swapInto = async <K>(runtime: KernelRuntime<K>, revision: KernelRevision): Promise<StageResult<K>> => {
  let candidate: KernelSlot<K>
  try {
    candidate = await runtime.adopt(revision)
  } catch (error) {
    runtime.emit({ kind: "rejected", revision, reason: messageOf(error) })
    return { ok: false, reason: "failed", error }
  }

  const displaced = runtime.active()
  try {
    await runtime.options.activate(candidate.kernel, revision)
  } catch (error) {
    // The flip itself failed. The old kernel was never stopped, so putting it
    // back in front cannot fail for a reason this swap created.
    await candidate.dispose()
    if (displaced !== undefined) await runtime.options.activate(displaced.kernel, displaced.revision)
    runtime.emit({ kind: "rejected", revision, reason: messageOf(error) })
    return { ok: false, reason: "failed", error }
  }

  // Committed. Only now may the displaced kernel stop — §6.2's core invariant.
  runtime.promote(candidate)
  runtime.persist({
    ...runtime.state(),
    active: revision,
    ...(displaced === undefined ? {} : { previous: displaced.revision }),
  })
  if (displaced !== undefined) await displaced.dispose()
  runtime.emit({ kind: "swapped", from: displaced?.revision, to: revision })
  return { ok: true, slot: candidate }
}
