import { defaultCompat, type CompatPolicy } from "@effect-agent/effect-compat"
import type { Ref, VersionVisibility } from "./version-refs.ts"

export interface Policy {
  readonly api: {
    readonly mode: "allowlist" | "denylist"
    readonly scope: ReadonlyArray<string>
  }
  readonly version: {
    readonly defaults: Readonly<Record<string, Ref>>
    readonly visibility: Readonly<Record<string, VersionVisibility>>
  }
  readonly compat: CompatPolicy
  readonly sandbox: {
    readonly runtime: "quickjs" | "graaljs" | "node-vm" | "isolated-vm"
    readonly timeoutMs: number
    readonly memoryMb: number
  }
  readonly allowAgentConfig: ReadonlyArray<string>
}

export const defaultPolicy: Policy = {
  api: { mode: "allowlist", scope: [] },
  version: { defaults: {}, visibility: {} },
  compat: defaultCompat,
  sandbox: { runtime: "isolated-vm", timeoutMs: 5000, memoryMb: 64 },
  allowAgentConfig: []
}
