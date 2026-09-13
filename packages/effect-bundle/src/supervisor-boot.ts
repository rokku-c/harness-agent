/**
 * §6.5-4's boot: start the recorded active revision, and fall back to the one it
 * displaced when that one cannot be started.
 *
 * A trust-nothing first boot: the revision this build carries is a candidate
 * like any other, and is recorded so the *next* boot has a rollback target —
 * which is the only reason this fallback has anywhere to fall back to.
 *
 * Every revision that fails the §5 judgement or the health check is *condemned*:
 * not retried, and not overwritten. A revision that could not run once is not
 * offered again, so a bad artifact cannot make every restart pay for it twice.
 */
import type { KernelRevision } from "./repo.ts"
import { describeRefusal, messageOf, type BootResult, type KernelSlot } from "./supervisor-outcome.ts"
import type { KernelRuntime } from "./supervisor-runtime.ts"

export const bootFrom = async <K>(runtime: KernelRuntime<K>, shipped?: KernelRevision): Promise<BootResult<K>> => {
  const order = [runtime.state().active, runtime.state().previous]
    .filter((revision): revision is KernelRevision => revision !== undefined)
    .filter((revision) => !runtime.condemned().includes(revision.revision))

  if (order.length === 0 && shipped !== undefined) order.push(shipped)
  if (order.length === 0) throw new Error("effect-bundle: no kernel revision to boot")

  const failures: string[] = []
  for (const [index, revision] of order.entries()) {
    const refusal = runtime.refusalFor(revision)
    if (refusal !== undefined) {
      failures.push(`${revision.kernelId}: ${describeRefusal(refusal)}`)
      runtime.condemn(revision)
      continue
    }

    let slot: KernelSlot<K>
    try {
      slot = await runtime.adopt(revision)
    } catch (error) {
      failures.push(`${revision.kernelId}: ${messageOf(error)}`)
      runtime.condemn(revision)
      continue
    }

    await runtime.options.activate(slot.kernel, revision)
    runtime.promote(slot)

    const broken = order[0]
    if (index === 0) {
      // The recorded active revision booted. Record the shipped one only when
      // the repo was empty — otherwise the index already says what is active.
      if (runtime.state().active === undefined) runtime.persist({ ...runtime.state(), active: revision })
      runtime.emit({ kind: "booted", revision })
      return { ok: true, slot }
    }

    const reason = failures.join("; ")
    runtime.persist({ ...runtime.state(), active: revision, previous: undefined })
    runtime.emit({ kind: "fell-back", from: broken, to: revision, reason })
    return { ok: true, slot, fellBack: { from: broken, reason } }
  }

  throw new Error(`effect-bundle: no kernel revision could boot — ${failures.join("; ")}`)
}
