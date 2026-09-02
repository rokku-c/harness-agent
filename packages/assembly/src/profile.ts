/**
 * Profile: the data-driven assembly (M2). A small TOML file maps to
 * AssembleOptions - the same seams, now chosen by configuration instead
 * of code. Real products extend the profile with product sections.
 */
import { existsSync, readFileSync } from "node:fs"
import { JsonlStore } from "@effect-agent/state"
import { MemoryChannel } from "@effect-agent/channel"
import { AllowAllGate, DenyWritesGate } from "@effect-agent/gate"
import type { AssembleOptions } from "./options.ts"

export interface Profile {
  readonly model?: { readonly provider?: string }
  readonly store?: { readonly kind?: "memory" | "jsonl"; readonly path?: string }
  readonly channel?: { readonly kind?: "memory" | "dingtalk" | "http" }
  readonly gate?: { readonly kind?: "allow" | "deny-writes"; readonly allowedSessions?: ReadonlyArray<string> }
}

export const loadProfile = (path: string): Profile => {
  if (!existsSync(path)) return {}
  return (Bun as any).TOML.parse(readFileSync(path, "utf8")) as Profile
}

export const profileToOptions = (profile: Profile): AssembleOptions => {
  const options: {
    readonly store?: unknown
    readonly channel?: unknown
    readonly gate?: unknown
  } = {}
  if (profile.store?.kind === "jsonl")
    (options as { store?: unknown }).store = new JsonlStore(profile.store.path ?? "./agent.jsonl")
  if (profile.channel?.kind === "memory")
    (options as { channel?: unknown }).channel = new MemoryChannel()
  if (profile.gate?.kind === "deny-writes")
    (options as { gate?: unknown }).gate = DenyWritesGate(profile.gate.allowedSessions ?? [])
  else if (profile.gate?.kind === "allow")
    (options as { gate?: unknown }).gate = AllowAllGate
  return options as unknown as AssembleOptions
}
