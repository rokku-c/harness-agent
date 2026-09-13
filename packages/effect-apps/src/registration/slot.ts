/**
 * What a slot is: one app's generation record, the options an install takes,
 * and the contract the slot answers to. The implementation is generations.ts;
 * one install attempt is install.ts.
 *
 * A generation is a descriptor *plus* the surface it actually registered and
 * the disposer that retires it — the two things a later install needs to judge
 * the incoming one and to put this one back if that judgement fails.
 */
import type { CompatPolicy, UpgradeReport } from "@effect-agent/effect-compat"
import type { EffectAppDescriptor } from "../descriptor.ts"
import type { AppToolSurface } from "./surface.ts"

export interface AppGeneration {
  readonly appId: string
  /** 1-based, monotonic per slot. */
  readonly generation: number
  readonly descriptor: EffectAppDescriptor
  /** the tool surface as it was actually registered — the basis for later diffs. */
  readonly surface: readonly AppToolSurface[]
  dispose(): Promise<void>
}

export interface InstallOptions {
  /** how to treat each breaking level; defaults to `defaultCompat` (schema/deps strict). */
  readonly policy?: CompatPolicy
  /** health check against the freshly installed generation; throwing aborts the install. */
  readonly probe?: (generation: AppGeneration) => void | Promise<void>
}

export type InstallResult =
  | { readonly ok: true; readonly generation: AppGeneration; readonly report: UpgradeReport }
  | {
      readonly ok: false
      /** "rejected" = adjudication said no; "failed" = registration or probe threw. */
      readonly reason: "rejected" | "failed"
      readonly report: UpgradeReport
      readonly error?: unknown
    }

export interface AppSlotOptions {
  /**
   * Called after every successful commit (install and rollback alike) — the
   * seam for work that has to observe the committed generation, such as a
   * health check or an audit record.
   */
  readonly onChange?: (generation: AppGeneration) => void | Promise<void>
}

export interface AppSlot {
  readonly appId: string
  /** the live generation, if any. */
  current(): AppGeneration | undefined
  /** the generation the current one displaced — the rollback target. */
  previous(): AppGeneration | undefined
  /** every generation that has been live, oldest first. */
  generations(): readonly AppGeneration[]
  /** install a generation; on rejection or failure the current one keeps serving. */
  install(next: EffectAppDescriptor, options?: InstallOptions): Promise<InstallResult>
  /** go back to the previous generation (install, run backwards — §5). */
  rollback(options?: InstallOptions): Promise<InstallResult>
  /** tear the app down entirely. */
  unload(): Promise<void>
}

/** Nothing was adjudicated — a first install, or a failure that never got that far. */
export const CLEAN: UpgradeReport = { ok: true, violations: [], warnings: [] }
