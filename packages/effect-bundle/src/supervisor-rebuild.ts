/**
 * §6.3-②: an effect-line move, paid for by rebuilding the apps it would break.
 *
 * Order is the doc's: `teardown → load B → flip → replay → commit`. Every step
 * that fails goes through the one recovery path (supervisor-restore.ts), which
 * is the only place that puts those apps back.
 *
 * `suspended` is the entire scope of the operation: the apps §5 named, and
 * nothing else (§6.5-6). Every verb below is handed that same list, so an app
 * that can speak to the new kernel is never stopped, never reloaded, and never
 * even mentioned to the host.
 *
 * The window here is genuinely longer than ①'s — those apps are down before the
 * flip, not after — and this file does not pretend otherwise. What it keeps is
 * the one invariant that makes recovery possible at all: **the displaced kernel
 * is never disposed before the flip is committed**, so every failure below has
 * somewhere to go back to.
 */
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
  // No live kernel means no app layer to rebuild against; the refusal stands.
  if (rebuild === undefined || displaced === undefined) {
    runtime.emit({ kind: "rejected", revision, reason: describeRefusal(refusal) })
    return { ok: false, reason: "apps-incompatible", refusal }
  }

  const suspended = refusal.broken.map((entry) => entry.app)
  runtime.emit({ kind: "rebuilding", revision, broken: refusal.broken })
  const failed = makeRecovery(runtime, rebuild, suspended, revision)

  // The broken apps come down first — this is ②'s window, and it is only ever
  // as wide as the breakage.
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
    // The flip failed. The displaced kernel was never stopped, so putting it
    // back in front cannot fail for a reason this rebuild created.
    await candidate.dispose()
    await runtime.options.activate(displaced.kernel, displaced.revision)
    return await failed(error)
  }

  try {
    await rebuild.replay(suspended)
  } catch (error) {
    // B is in front but the suspended apps did not come back on it. A was never
    // stopped, so the way out is still open: flip back, then let `failed` replay
    // once more — this time against a kernel those apps are known to work with.
    await runtime.options.activate(displaced.kernel, displaced.revision)
    await candidate.dispose()
    return await failed(error)
  }

  // Committed. Only now may the displaced kernel stop — §6.2's invariant holds
  // in ② as well, which is the whole reason every failure above had a way back.
  runtime.promote(candidate)
  runtime.persist({ ...runtime.state(), active: revision, previous: displaced.revision })
  await displaced.dispose()
  runtime.emit({ kind: "rebuilt", from: displaced.revision, to: revision })
  return { ok: true, slot: candidate }
}
