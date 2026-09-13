/**
 * The kernel supervisor — the double-buffer switch of docs/architecture-rework.md
 * §6.2, assembled from the layers it is made of.
 *
 * §6.3 has **two** ways a kernel can be replaced, and this file is the one line
 * that chooses between them:
 *
 *   ① compatible        ─► the flip (supervisor-swap.ts); apps are never touched
 *   ② effect-line moves ─► the apps the new kernel would *break* are rebuilt
 *                          (supervisor-rebuild.ts): unload them, load B, replay
 *                          them, commit
 *
 * ② exists because an app that declared `effect-1` cannot be served by a kernel
 * that only speaks `effect-2` — those apps have to be re-registered against the
 * new line. What ② must not do is take down the apps that *can* speak to B
 * (§6.5-6's third disposition): the window is only ever as wide as the damage,
 * and an app the matrix cleared goes on serving across the whole swap.
 *
 * The kernel is generic (`K`): this state machine is about revisions and
 * pointers, not about what a kernel is. `load` is injected, so today it returns
 * this repo's kernel and tomorrow it returns a compiled artifact's — the switch
 * does not change (see boot/kernel.ts for the declared revisions).
 */
import type { KernelRevision } from "./repo.ts"
import { bootFrom } from "./supervisor-boot.ts"
import { describeRefusal, type StageResult } from "./supervisor-outcome.ts"
import { rebuildInto } from "./supervisor-rebuild.ts"
import { makeKernelRuntime, type KernelRuntime } from "./supervisor-runtime.ts"
import { swapInto } from "./supervisor-swap.ts"
import type { KernelSupervisor, SupervisorOptions } from "./supervisor-types.ts"

/**
 * §6.3's choice: which disposition a revision gets, if it gets one at all.
 *
 * A refusal on the *bootstrap* line is the host's own (§5): no amount of
 * rebuilding the app layer makes a kernel this host cannot run runnable. Only an
 * effect-line move — a kernel the host *can* run, that its apps cannot speak
 * to — is something ② can pay for.
 */
const stageKernel = async <K>(runtime: KernelRuntime<K>, revision: KernelRevision): Promise<StageResult<K>> => {
  const refusal = runtime.refusalFor(revision)
  if (refusal === undefined) return await swapInto(runtime, revision)
  if (refusal.kind === "incompatible") {
    runtime.emit({ kind: "rejected", revision, reason: describeRefusal(refusal) })
    return { ok: false, reason: "incompatible", refusal }
  }
  return await rebuildInto(runtime, revision, refusal)
}

export const makeKernelSupervisor = <K>(options: SupervisorOptions<K>): KernelSupervisor<K> => {
  const runtime = makeKernelRuntime(options)
  return {
    boot: (shipped) => bootFrom(runtime, shipped),
    stage: (revision) => stageKernel(runtime, revision),
    state: () => runtime.state(),
    active: () => runtime.active(),
    previous: () => runtime.previous(),
  }
}
