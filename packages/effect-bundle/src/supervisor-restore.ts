import { messageOf } from "@effect-agent/effect-interface"
import type { KernelRevision } from "./repo.ts"
import { type StageResult } from "./supervisor-outcome.ts"
import type { KernelRuntime } from "./supervisor-runtime.ts"
import type { AppRebuild } from "./supervisor-types.ts"

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
