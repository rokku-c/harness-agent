/**
 * What a machine says it can run (§8.3): `abi:effect-1 · bootstrap:bootstrap-1
 * · runtime:os`, read back as fields.
 *
 * Kept apart from the adjudication that consumes it (`bundles.ts`) because the
 * two fail for different reasons. A malformed declaration is not a compatibility
 * verdict — nothing here knows what artifact is being pushed — so it is refused
 * on its own, before the SDK's gates are ever asked.
 */

import { EFFECT_RUNTIME_KINDS, type EffectRuntimeKind } from "@effect-agent/effect-bundle"
import { AgentdError } from "./errors.ts"
import type { Machine } from "./types.ts"

export interface MachineCapability {
  readonly abi?: string
  readonly bootstrapAbi?: string
  readonly runtime?: EffectRuntimeKind
}

/** `runtime:os` is a closed vocabulary; `isRuntime` is the one place it is read. */
export const isRuntime = (value: string): value is EffectRuntimeKind =>
  (EFFECT_RUNTIME_KINDS as readonly string[]).includes(value)

/**
 * Read a machine's declared capabilities.
 *
 * An unrecognized `runtime:` value is an error rather than a silent fallback: a
 * typo'd `runtime:brower` would otherwise push OS artifacts to a browser host
 * and be discovered at load time on that machine, which is the failure mode
 * "fail loud, never silently downgrade" (§5) exists to prevent.
 */
export const machineCapability = (machine: Pick<Machine, "capabilities">): MachineCapability => {
  const out: { abi?: string; bootstrapAbi?: string; runtime?: EffectRuntimeKind } = {}
  for (const raw of machine.capabilities) {
    const at = raw.indexOf(":")
    if (at <= 0) continue
    const key = raw.slice(0, at), value = raw.slice(at + 1)
    if (key === "abi") out.abi = value
    else if (key === "bootstrap") out.bootstrapAbi = value
    else if (key === "runtime") {
      if (!isRuntime(value)) {
        throw new AgentdError(400, `machine declares an unknown runtime "${value}"; expected one of ${EFFECT_RUNTIME_KINDS.join(" | ")}`)
      }
      out.runtime = value
    }
  }
  return out
}
