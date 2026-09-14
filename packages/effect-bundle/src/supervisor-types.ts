import type { BootstrapCapability } from "./kernel.ts"
import type { DeclaredApp } from "./kernel-matrix.ts"
import type { KernelRepo, KernelRevision, KernelState } from "./repo.ts"
import type { SupervisorEvent } from "./supervisor-events.ts"
import type { BootResult, KernelSlot, StageResult } from "./supervisor-outcome.ts"

export interface AppRebuild {
  teardown(apps: readonly string[]): Promise<void>
  replay(apps: readonly string[]): Promise<void>
}

export interface SupervisorOptions<K> {
  readonly repo: KernelRepo
  readonly load: (revision: KernelRevision) => Promise<K>
  readonly dispose?: (kernel: K) => void | Promise<void>
  readonly activate: (kernel: K, revision: KernelRevision) => void | Promise<void>
  readonly probe?: (slot: KernelSlot<K>) => void | Promise<void>
  readonly apps?: () => readonly DeclaredApp[]
  readonly rebuild?: AppRebuild
  readonly host?: BootstrapCapability
  readonly onEvent?: (event: SupervisorEvent) => void
}

export interface KernelSupervisor<K> {
  boot(shipped?: KernelRevision): Promise<BootResult<K>>
  stage(revision: KernelRevision): Promise<StageResult<K>>
  state(): KernelState
  active(): KernelSlot<K> | undefined
  previous(): KernelSlot<K> | undefined
}
