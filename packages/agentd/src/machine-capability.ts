import { EFFECT_RUNTIME_KINDS, type EffectRuntimeKind } from "@effect-agent/effect-bundle"
import { AgentdError } from "./errors.ts"
import type { Machine } from "./types.ts"

export interface MachineCapability {
  readonly abi?: string
  readonly bootstrapAbi?: string
  readonly runtime?: EffectRuntimeKind
}

export const isRuntime = (value: string): value is EffectRuntimeKind =>
  (EFFECT_RUNTIME_KINDS as readonly string[]).includes(value)

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
