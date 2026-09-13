/**
 * The one place a ② attempt puts the suspended apps back.
 *
 * Every step of §6.3-② that fails lands here — teardown, load, flip or replay —
 * so there is one recovery path and not four, and none of them can drift into
 * claiming a rollback that did not happen.
 *
 * And it says plainly when even the recovery failed: a node whose apps did not
 * come back needs a restart, and reporting a rollback that only looks successful
 * would be worse than the failure itself.
 */
import type { KernelRevision } from "./repo.ts"
import { messageOf, type StageResult } from "./supervisor-outcome.ts"
import type { KernelRuntime } from "./supervisor-runtime.ts"
import type { AppRebuild } from "./supervisor-types.ts"

/** Hand the suspended apps back after a failed attempt, and report the outcome either way. */
export const makeRecovery = <K>(
  runtime: KernelRuntime<K>,
  rebuild: AppRebuild,
  suspended: readonly string[],
  revision: KernelRevision,
): ((cause: unknown) => Promise<StageResult<K>>) => {
  return async (cause: unknown): Promise<StageResult<K>> => {
    const reason = messageOf(cause)
    let error = cause
    let restored = true
    try {
      await rebuild.replay(suspended)
    } catch (restoreError) {
      restored = false
      error = new Error(
        `effect-bundle: kernel ${revision.kernelId} could not be staged (${reason}), and the apps it ` +
        `suspended could not be restored (${messageOf(restoreError)}); this node needs a restart`,
      )
    }
    runtime.emit({ kind: "rebuild-failed", revision, reason: messageOf(error), restored })
    return { ok: false, reason: "failed", error }
  }
}
