import type { KernelRevision } from "./repo.ts"
import { bootFrom } from "./supervisor-boot.ts"
import { describeRefusal, type StageResult } from "./supervisor-outcome.ts"
import { rebuildInto } from "./supervisor-rebuild.ts"
import { makeKernelRuntime, type KernelRuntime } from "./supervisor-runtime.ts"
import { swapInto } from "./supervisor-swap.ts"
import type { KernelSupervisor, SupervisorOptions } from "./supervisor-types.ts"

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
