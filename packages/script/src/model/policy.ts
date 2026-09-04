/**
 * model/policy.go - the AGENT POLICY document.
 *
 * Concept: what one agent is allowed to see and override - the api scope
 * (allowlist/denylist), the default versions and visibility per tool, the
 * compat policy, the sandbox limits, and the fine-grained whitelist of
 * config paths the agent may override. A complete policy is the whole
 * document; defaults are exported for a fresh agent.
 */
import type { CompatPolicy } from "./compat.ts"
import type { Ref, VersionVisibility } from "./version-refs.ts"

export interface Policy {
  readonly api: {
    readonly mode: "allowlist" | "denylist"
    readonly scope: ReadonlyArray<string>
  }
  readonly version: {
    /** Agent's default versions: tool -> Ref */
    readonly defaults: Readonly<Record<string, Ref>>
    readonly visibility: Readonly<Record<string, VersionVisibility>>
  }
  readonly compat: CompatPolicy
  readonly sandbox: {
    readonly runtime: "quickjs" | "graaljs" | "node-vm" | "isolated-vm"
    readonly timeoutMs: number
    readonly memoryMb: number
  }
  /** Fine-grained whitelist: config paths an agent may override (dot paths, e.g. "compat.schema") */
  readonly allowAgentConfig: ReadonlyArray<string>
}

export const defaultPolicy: Policy = {
  api: { mode: "allowlist", scope: [] },
  version: { defaults: {}, visibility: {} },
  compat: { schema: "strict", deps: "strict", description: "warn", behavior: "require-declaration" },
  sandbox: { runtime: "isolated-vm", timeoutMs: 5000, memoryMb: 64 },
  allowAgentConfig: []
}
