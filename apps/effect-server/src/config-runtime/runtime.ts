import type { ConfigRegistry, ConfigOutcome } from "@effect-agent/effect-config"
import type { ConfigRuntime, RuntimeConfigOutcome } from "./types.ts"
import { keyedSerial } from "./serial.ts"

/** Saved values are durable; active values change only at boot or explicit apply. */
export const makeConfigRuntime = (
  configs: ConfigRegistry,
  reload: (appId: string) => Promise<void> = async () => {},
): ConfigRuntime => {
  const active = new Map<string, unknown>()
  const serial = keyedSerial()
  const pending = (id: string, out: ConfigOutcome) =>
    JSON.stringify(active.get(id)) !== JSON.stringify(out.value)
  const read = (id: string): RuntimeConfigOutcome => {
    const out = configs.read(id)
    return { ...out, pendingRestart: out.ok && pending(id, out) }
  }
  const apply = async (id: string): Promise<RuntimeConfigOutcome> => {
    const next = configs.read(id)
    if (!next.ok) return { ...next, pendingRestart: false }
    const previous = active.get(id)
    active.set(id, structuredClone(next.value))
    try { await reload(id) }
    catch (error) {
      active.set(id, previous)
      try { await reload(id) } catch { /* saved state remains pending, report original failure */ }
      return { ...read(id), ok: false, error: `Saved but not applied: ${error instanceof Error ? error.message : String(error)}` }
    }
    return read(id)
  }
  return {
    initialize(id, layers) {
      const out = configs.initialize(id, layers)
      if (!out.ok) throw new Error(`Invalid config for ${id}: ${out.error}`)
      if (!active.has(id)) active.set(id, structuredClone(out.value))
    },
    active(id) {
      if (!active.has(id)) throw new Error(`Config not initialized: ${id}`)
      return structuredClone(active.get(id))
    },
    read,
    save: (id, patch, strategy, unset) => serial(id, async () => {
      const out = configs.save(id, patch, { unset })
      if (!out.ok) return { ...out, pendingRestart: read(id).pendingRestart }
      return strategy === "apply" ? apply(id) : read(id)
    }),
    apply: (id) => serial(id, () => apply(id)),
  }
}
