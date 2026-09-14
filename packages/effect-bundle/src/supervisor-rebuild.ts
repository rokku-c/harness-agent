import type { KernelRevision } from "./repo.ts"
import { describeRefusal, type KernelSlot, type Refusal, type StageResult } from "./supervisor-outcome.ts"
import { makeRecovery } from "./supervisor-restore.ts"
import type { KernelRuntime } from "./supervisor-runtime.ts"

export const rebuildInto = async <K>(
  runtime: KernelRuntime<K>,
  revision: KernelRevision,
  refusal: Refusal & { readonly kind: "apps" },
): Promise<StageResult<K>> => {
  const rebuild = runtime.options.rebuild
  const displaced = runtime.active()
  if (rebuild === undefined || displaced === undefined) {
    runtime.emit({ kind: "rejected", revision, reason: describeRefusal(refusal) })
    return { ok: false, reason: "apps-incompatible", refusal }
  }

  const suspended = refusal.broken.map((entry) => entry.app)
  runtime.emit({ kind: "rebuilding", revision, broken: refusal.broken })
  const failed = makeRecovery(runtime, rebuild, suspended, revision)

  try {
    await rebuild.teardown(suspended)
  } catch (error) {
    return await failed(error)
  }

  let candidate: KernelSlot<K>
  try {
    candidate = await runtime.adopt(revision)
  } catch (error) {
    return await failed(error)
  }

  try {
    await runtime.options.activate(candidate.kernel, revision)
  } catch (error) {
    await candidate.dispose()
    await runtime.options.activate(displaced.kernel, displaced.revision)
    return await failed(error)
  }

  try {
    await rebuild.replay(suspended)
  } catch (error) {
    await runtime.options.activate(displaced.kernel, displaced.revision)
    await candidate.dispose()
    return await failed(error)
  }

  runtime.promote(candidate)
  runtime.persist({ ...runtime.state(), active: revision, previous: displaced.revision })
  await displaced.dispose()
  runtime.emit({ kind: "rebuilt", from: displaced.revision, to: revision })
  return { ok: true, slot: candidate }
}
