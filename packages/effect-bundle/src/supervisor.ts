/**
 * Kernel supervisor — the double-buffer switch of docs/architecture-rework.md
 * §6.2, and the boot-time rollback of §6.5-4.
 *
 *   stage B ─► compat matrix (§5: bootstrap line + every loaded app) ─► health check
 *        ├─ refuse ─► discard B; A keeps serving, untouched
 *        └─ pass   ─► flip the dispatcher ─► persist(active=B, previous=A) ─► stop A
 *
 * The invariant that makes this different from "unload then load": **A is never
 * stopped before the flip is committed**. If anything fails up to that point, A
 * is still loaded and still in front, so recovery is not a rebuild — it is
 * simply *not having moved*. If the flip itself throws, A is put back in front;
 * it was never stopped, so putting it back cannot fail for a reason we created.
 *
 * The kernel is generic (`K`): this state machine is about revisions and
 * pointers, not about what a kernel is. `load` is injected, so today it returns
 * this repo's kernel and tomorrow it returns a compiled artifact's — the switch
 * does not change (see boot/kernel.ts for the declared revisions).
 *
 * §6.3 has **two** ways a kernel can be replaced, and only the first is a pure
 * swap:
 *
 *   ① compatible        ─► the flip above; apps are never touched
 *   ② effect-line moves ─► the apps the new kernel would *break* are rebuilt:
 *                          unload them, load B, replay them, commit
 *
 * ② exists because an app that declared `effect-1` cannot be served by a kernel
 * that only speaks `effect-2` — those apps have to be re-registered against the
 * new line. What ② must not do is take down the apps that *can* speak to B
 * (§6.5-6's third disposition): the window is only ever as wide as the damage,
 * and an app the matrix cleared goes on serving across the whole swap. For the
 * apps that are rebuilt the window is genuinely longer than ①'s — they are down
 * before the flip, not after — and this file does not pretend otherwise. What it
 * keeps is the one invariant that makes recovery possible at all: **the displaced
 * kernel is never disposed before the flip is committed**, so every failure below
 * has somewhere to go back to.
 */

import type { Incompatibility } from "./compat.ts"
import {
  assessKernelAgainst,
  assessKernelCompat,
  type BootstrapCapability,
  type DeclaredApp,
  type KernelAppIncompatibility,
} from "./kernel.ts"
import { type KernelRepo, type KernelRevision, type KernelState } from "./repo.ts"

/** One loaded kernel revision, and the means to stop it. */
export interface KernelSlot<K> {
  readonly revision: KernelRevision
  readonly kernel: K
  dispose(): Promise<void>
}

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

export type SupervisorEvent =
  | { readonly kind: "booted"; readonly revision: KernelRevision }
  | { readonly kind: "fell-back"; readonly from: KernelRevision; readonly to: KernelRevision; readonly reason: string }
  | { readonly kind: "staged"; readonly revision: KernelRevision }
  | { readonly kind: "rejected"; readonly revision: KernelRevision; readonly reason: string }
  | { readonly kind: "swapped"; readonly from: KernelRevision | undefined; readonly to: KernelRevision }
  | { readonly kind: "rebuilding"; readonly revision: KernelRevision; readonly broken: readonly KernelAppIncompatibility[] }
  | { readonly kind: "rebuilt"; readonly from: KernelRevision; readonly to: KernelRevision }
  /** A ② attempt that did not restore the app layer. `restored: false` = restart needed. */
  | { readonly kind: "rebuild-failed"; readonly revision: KernelRevision; readonly reason: string; readonly restored: boolean }

/** Why a revision may not run here. Both halves of §5, kept distinguishable. */
export type Refusal =
  | { readonly kind: "incompatible"; readonly reason: Incompatibility }
  | { readonly kind: "apps"; readonly broken: readonly KernelAppIncompatibility[] }

export const describeRefusal = (refusal: Refusal): string =>
  refusal.kind === "incompatible"
    ? refusal.reason.message
    : `would break ${refusal.broken.length} loaded app(s): ` +
      refusal.broken.map((entry) => `${entry.app} (${entry.reason.message})`).join("; ")

export type StageResult<K> =
  | { readonly ok: true; readonly slot: KernelSlot<K> }
  | { readonly ok: false; readonly reason: "incompatible" | "apps-incompatible"; readonly refusal: Refusal }
  | { readonly ok: false; readonly reason: "failed"; readonly error: unknown }

export type BootResult<K> = {
  readonly ok: true
  readonly slot: KernelSlot<K>
  /** Present when the recorded active revision could not be loaded (§6.5-4). */
  readonly fellBack?: { readonly from: KernelRevision; readonly reason: string }
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

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export const makeKernelSupervisor = <K>(options: SupervisorOptions<K>): KernelSupervisor<K> => {
  const emit = (event: SupervisorEvent): void => options.onEvent?.(event)

  let state: KernelState = options.repo.read()
  let live: KernelSlot<K> | undefined
  let prior: KernelSlot<K> | undefined

  const persist = (next: KernelState): void => {
    state = next
    options.repo.write(next)
  }

  const condemned = (): readonly number[] => state.condemned ?? []

  const condemn = (revision: KernelRevision): void => {
    if (condemned().includes(revision.revision)) return
    persist({ ...state, condemned: [...condemned(), revision.revision] })
  }

  /** Both halves of the §5 judgement, or undefined when the revision may run. */
  const refusalFor = (revision: KernelRevision): Refusal | undefined => {
    const verdict = assessKernelCompat(revision, options.host)
    if (!verdict.ok) return { kind: "incompatible", reason: verdict.reason }
    const broken = assessKernelAgainst(revision, options.apps?.() ?? [], options.host)
    return broken.length === 0 ? undefined : { kind: "apps", broken }
  }

  /** Load + health-check a revision. Nothing is flipped yet; on failure it is dropped. */
  const adopt = async (revision: KernelRevision): Promise<KernelSlot<K>> => {
    const kernel = await options.load(revision)
    const slot: KernelSlot<K> = {
      revision,
      kernel,
      dispose: async () => { await options.dispose?.(kernel) },
    }
    if (options.probe !== undefined) {
      try {
        await options.probe(slot)
      } catch (error) {
        await slot.dispose()
        throw error
      }
    }
    return slot
  }

  const boot = async (shipped?: KernelRevision): Promise<BootResult<K>> => {
    const order = [state.active, state.previous]
      .filter((revision): revision is KernelRevision => revision !== undefined)
      .filter((revision) => !condemned().includes(revision.revision))

    // A trust-nothing first boot: the revision this build carries is a candidate
    // like any other, and is recorded so the *next* boot has a rollback target.
    if (order.length === 0 && shipped !== undefined) order.push(shipped)
    if (order.length === 0) throw new Error("effect-bundle: no kernel revision to boot")

    const failures: string[] = []
    for (const [index, revision] of order.entries()) {
      const refusal = refusalFor(revision)
      if (refusal !== undefined) {
        failures.push(`${revision.kernelId}: ${describeRefusal(refusal)}`)
        condemn(revision)
        continue
      }

      let slot: KernelSlot<K>
      try {
        slot = await adopt(revision)
      } catch (error) {
        failures.push(`${revision.kernelId}: ${messageOf(error)}`)
        condemn(revision)
        continue
      }

      await options.activate(slot.kernel, revision)
      live = slot

      const broken = order[0]
      if (index === 0) {
        // The recorded active revision booted. Record the shipped one only when
        // the repo was empty — otherwise the index already says what is active.
        if (state.active === undefined) persist({ ...state, active: revision })
        emit({ kind: "booted", revision })
        return { ok: true, slot }
      }

      const reason = failures.join("; ")
      persist({ ...state, active: revision, previous: undefined })
      emit({ kind: "fell-back", from: broken, to: revision, reason })
      return { ok: true, slot, fellBack: { from: broken, reason } }
    }

    throw new Error(`effect-bundle: no kernel revision could boot — ${failures.join("; ")}`)
  }

  /**
   * §6.3-②: an effect-line move, paid for by rebuilding the apps it would break.
   *
   * Order is the doc's: `teardown → load B → flip → replay → commit`. Every step
   * that fails lands in `failed`, which is the only place that puts those apps
   * back — one recovery path, not four.
   *
   * `suspended` is the entire scope of the operation: the apps §5 named, and
   * nothing else (§6.5-6). Every verb below is handed that same list, so an app
   * that can speak to the new kernel is never stopped, never reloaded, and never
   * even mentioned to the host.
   */
  const rebuildInto = async (
    revision: KernelRevision,
    refusal: Refusal & { readonly kind: "apps" },
  ): Promise<StageResult<K>> => {
    const rebuild = options.rebuild
    const displaced = live
    // No live kernel means no app layer to rebuild against; the refusal stands.
    if (rebuild === undefined || displaced === undefined) {
      emit({ kind: "rejected", revision, reason: describeRefusal(refusal) })
      return { ok: false, reason: "apps-incompatible", refusal }
    }

    const suspended = refusal.broken.map((entry) => entry.app)
    emit({ kind: "rebuilding", revision, broken: refusal.broken })

    /**
     * Hand the suspended apps back after a failed attempt, and say plainly when
     * even that did not work: a node whose apps did not come back needs a
     * restart, and reporting a rollback that only looks successful would be worse
     * than the failure itself.
     */
    const failed = async (cause: unknown): Promise<StageResult<K>> => {
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
      emit({ kind: "rebuild-failed", revision, reason: messageOf(error), restored })
      return { ok: false, reason: "failed", error }
    }

    // The broken apps come down first — this is ②'s window, and it is only ever
    // as wide as the breakage.
    try {
      await rebuild.teardown(suspended)
    } catch (error) {
      return await failed(error)
    }

    let candidate: KernelSlot<K>
    try {
      candidate = await adopt(revision)
    } catch (error) {
      return await failed(error)
    }

    try {
      await options.activate(candidate.kernel, revision)
    } catch (error) {
      // The flip failed. The displaced kernel was never stopped, so putting it
      // back in front cannot fail for a reason this rebuild created.
      await candidate.dispose()
      await options.activate(displaced.kernel, displaced.revision)
      return await failed(error)
    }

    try {
      await rebuild.replay(suspended)
    } catch (error) {
      // B is in front but the suspended apps did not come back on it. A was never
      // stopped, so the way out is still open: flip back, then let `failed` replay
      // once more — this time against a kernel those apps are known to work with.
      await options.activate(displaced.kernel, displaced.revision)
      await candidate.dispose()
      return await failed(error)
    }

    // Committed. Only now may the displaced kernel stop — §6.2's invariant holds
    // in ② as well, which is the whole reason every failure above had a way back.
    live = candidate
    prior = displaced
    persist({ ...state, active: revision, previous: displaced.revision })
    await displaced.dispose()
    emit({ kind: "rebuilt", from: displaced.revision, to: revision })
    return { ok: true, slot: candidate }
  }

  const stage = async (revision: KernelRevision): Promise<StageResult<K>> => {
    const refusal = refusalFor(revision)
    if (refusal !== undefined) {
      // The bootstrap line is the host's own (§5): no amount of rebuilding the
      // app layer makes a kernel this host cannot run runnable. Only an
      // effect-line move — a kernel the host *can* run, that its apps cannot
      // speak to — is something ② can pay for.
      if (refusal.kind === "incompatible") {
        emit({ kind: "rejected", revision, reason: describeRefusal(refusal) })
        return { ok: false, reason: "incompatible", refusal }
      }
      return await rebuildInto(revision, refusal)
    }

    let candidate: KernelSlot<K>
    try {
      candidate = await adopt(revision)
    } catch (error) {
      emit({ kind: "rejected", revision, reason: messageOf(error) })
      return { ok: false, reason: "failed", error }
    }

    const displaced = live
    try {
      await options.activate(candidate.kernel, revision)
    } catch (error) {
      // The flip itself failed. The old kernel was never stopped, so putting it
      // back in front cannot fail for a reason this swap created.
      await candidate.dispose()
      if (displaced !== undefined) await options.activate(displaced.kernel, displaced.revision)
      emit({ kind: "rejected", revision, reason: messageOf(error) })
      return { ok: false, reason: "failed", error }
    }

    // Committed. Only now may the displaced kernel stop — §6.2's core invariant.
    live = candidate
    prior = displaced
    persist({
      ...state,
      active: revision,
      ...(displaced === undefined ? {} : { previous: displaced.revision }),
    })
    if (displaced !== undefined) await displaced.dispose()
    emit({ kind: "swapped", from: displaced?.revision, to: revision })
    return { ok: true, slot: candidate }
  }

  return {
    boot,
    stage,
    state: () => state,
    active: () => live,
    previous: () => prior,
  }
}
