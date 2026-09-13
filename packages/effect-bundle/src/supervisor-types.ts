/**
 * The supervisor's host-facing contract: what a call site hands in, and what it
 * gets back.
 *
 * Nothing here runs. These are the two shapes the assembly in supervisor.ts
 * joins — and the place to look to see what the kernel is injected with, since
 * every verb the host owns (`load`, `activate`, `probe`, the app layer) arrives
 * as one of these fields rather than being assumed.
 */
import type { BootstrapCapability } from "./kernel.ts"
import type { DeclaredApp } from "./kernel-matrix.ts"
import type { KernelRepo, KernelRevision, KernelState } from "./repo.ts"
import type { SupervisorEvent } from "./supervisor-events.ts"
import type { BootResult, KernelSlot, StageResult } from "./supervisor-outcome.ts"

/**
 * The app layer as something the host can take down and put back (§6.3-②).
 *
 * The supervisor is generic over the kernel and knows nothing about apps — it
 * only ever sees their *declarations*, for the §5 matrix. Loading and unloading
 * them is the host's job, so ② is offered as an injected capability rather than
 * built in: without it, an effect-line move is refused exactly as before.
 *
 * Both verbs are addressed by name and always take a *subset*: the apps the
 * incoming kernel would break, and nothing else (§6.5-6). There is deliberately
 * no "no argument means all of them" form — the wide version is exactly the
 * blast radius this disposition exists to remove.
 */
export interface AppRebuild {
  /** Drain in-flight app work and unload these apps. */
  teardown(apps: readonly string[]): Promise<void>
  /** Load these apps back, against whichever kernel is live. */
  replay(apps: readonly string[]): Promise<void>
}

export interface SupervisorOptions<K> {
  readonly repo: KernelRepo
  /** Load one revision's artifact into a kernel instance. */
  readonly load: (revision: KernelRevision) => Promise<K>
  /** Stop a kernel instance once it has been retired. */
  readonly dispose?: (kernel: K) => void | Promise<void>
  /** §6.2's atomic flip: point the request dispatcher at this kernel. */
  readonly activate: (kernel: K, revision: KernelRevision) => void | Promise<void>
  /** Health check against a freshly loaded kernel. Throwing refuses the candidate. */
  readonly probe?: (slot: KernelSlot<K>) => void | Promise<void>
  /**
   * The apps this host has *loaded*, as an incoming kernel must see them (§5's
   * matrix). Loaded, not merely discoverable: only an app that is running can be
   * broken by a swap, and only a running app can be suspended for one.
   */
  readonly apps?: () => readonly DeclaredApp[]
  /**
   * §6.3-②'s app layer. Absent = the older, stricter behaviour: a kernel that
   * would break loaded apps is refused. Present = such a kernel is *rebuilt in*.
   */
  readonly rebuild?: AppRebuild
  /** The host's side of the two ABI lines. */
  readonly host?: BootstrapCapability
  readonly onEvent?: (event: SupervisorEvent) => void
}

export interface KernelSupervisor<K> {
  /**
   * Start the recorded active revision, falling back to the previous one when it
   * cannot be loaded (§6.5-4). `shipped` is the revision this build carries — it
   * is what an empty repo boots from, and is recorded so the next boot has a
   * rollback target.
   */
  boot(shipped?: KernelRevision): Promise<BootResult<K>>
  /** Swap to `revision`, or leave the active one exactly as it was. */
  stage(revision: KernelRevision): Promise<StageResult<K>>
  state(): KernelState
  active(): KernelSlot<K> | undefined
  previous(): KernelSlot<K> | undefined
}
