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
    await candidate.dispose()
    if (displaced !== undefined) await runtime.options.activate(displaced.kernel, displaced.revision)
    runtime.emit({ kind: "rejected", revision, reason: messageOf(error) })
    return { ok: false, reason: "failed", error }
  }

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
