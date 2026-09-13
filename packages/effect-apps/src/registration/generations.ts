/**
 * App generations — single-app hot replacement with per-app rollback
 * (docs/architecture-rework.md §6.4, §6.5-7).
 *
 * Why a single app can be swapped while its neighbours keep serving: every
 * registration the SDK makes is individually reversible AND identity-guarded.
 *
 *   - `effect-host` `register()` replaces by plugin id, unloading the previous
 *     entry itself (lifecycle.ts:26) — install order is "load next, retire old".
 *   - `EffectRegistry`'s disposer removes a record only if the identity still
 *     matches (registry.ts:83), so retiring the old generation cannot delete
 *     the new one.
 *   - `registerMap` keys disposal on a **generation token**, not the value
 *     (metadata.ts:6-18) — "replacement HTML/UI may be identical".
 *
 * So the swap itself is the host's existing replace-by-id; what this module adds
 * is the part that was missing: a retained previous generation, a health probe,
 * and schema-breakage adjudication — with the old generation restored on failure.
 *
 * Adjudication is delegated to @effect-agent/effect-compat (the same four-level
 * model the script sandbox uses), per §5's "one recursive mechanism".
 */

import {
  assessChange,
  defaultCompat,
  type AssessableTool,
  type CompatPolicy,
  type UpgradeReport,
  type Violation,
} from "@effect-agent/effect-compat"
import type { EffectAppDescriptor, EffectAppHost } from "../descriptor.ts"
import { registerEffectApp } from "./register.ts"
import type { AsyncAppDisposer } from "./disposal.ts"

/** One tool of an app's surface, in the shape the shared adjudicator understands. */
export interface AppToolSurface extends AssessableTool {
  readonly name: string
}

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

const CLEAN: UpgradeReport = { ok: true, violations: [], warnings: [] }

/** The tool surface an app currently exposes, read back from the live registry. */
export const readAppSurface = (host: EffectAppHost, appId: string): readonly AppToolSurface[] => {
  const registry = host.registry
  if (registry === undefined) return []
  const out: AppToolSurface[] = []
  for (const entry of registry.tools()) {
    if (entry.interfaceId !== appId) continue
    const schema = registry.schemaFor(entry.key)
    out.push({
      name: entry.tool.name,
      description: schema?.description ?? entry.tool.description,
      input: schema?.parameters,
      output: schema?.output,
    })
  }
  return out
}

/**
 * Surface-level adjudication: pairwise for tools present in both generations,
 * as a schema-level removal when a tool disappears. Additions are not a
 * violation — nothing that could already call the app breaks because a new tool
 * appeared.
 */
export const assessSurfaceChange = (
  from: readonly AppToolSurface[],
  to: readonly AppToolSurface[],
  policy: CompatPolicy,
): UpgradeReport => {
  const violations: Violation[] = []
  const unmatched = new Map(from.map((tool) => [tool.name, tool]))

  for (const tool of to) {
    const before = unmatched.get(tool.name)
    if (before === undefined) continue
    unmatched.delete(tool.name)
    const report = assessChange(before, tool, policy)
    violations.push(...report.violations)
  }
  for (const name of unmatched.keys()) {
    violations.push({ level: "schema", mode: policy.schema, reason: `tool "${name}" was removed` })
  }

  return {
    ok: violations.every((violation) => violation.mode !== "strict"),
    violations,
    warnings: violations.filter((violation) => violation.mode === "warn"),
  }
}

/**
 * A per-app slot over one host. Several slots may share a host: each app's
 * generation history is independent, which is what makes the blast radius of a
 * swap "one app, neighbours untouched".
 */
export const makeAppSlot = (
  host: EffectAppHost,
  appId: string,
  slotOptions: AppSlotOptions = {},
): AppSlot => {
  const gens: AppGeneration[] = []
  let nextGeneration = 1

  const current = (): AppGeneration | undefined => gens[gens.length - 1]
  const previous = (): AppGeneration | undefined => (gens.length > 1 ? gens[gens.length - 2] : undefined)

  /** Re-install `gen`'s descriptor and make it the live generation again. */
  const restore = async (gen: AppGeneration): Promise<void> => {
    const dispose = await registerEffectApp(host, gen.descriptor)
    const restored: AppGeneration = { ...gen, dispose, surface: readAppSurface(host, appId) }
    const index = gens.lastIndexOf(gen)
    if (index === -1) gens.push(restored)
    else gens[index] = restored
  }

  const install = async (app: EffectAppDescriptor, options: InstallOptions = {}): Promise<InstallResult> => {
    const policy = options.policy ?? defaultCompat
    const before = current()

    let dispose: AsyncAppDisposer
    try {
      dispose = await registerEffectApp(host, app)
    } catch (error) {
      // The host unloads the previous entry before loading this one, so a throw
      // here would otherwise leave the app down. Put the old generation back.
      if (before !== undefined) await restore(before)
      return { ok: false, reason: "failed", report: CLEAN, error }
    }

    const surface = readAppSurface(host, appId)
    const report = before === undefined ? CLEAN : assessSurfaceChange(before.surface, surface, policy)
    if (!report.ok) {
      await dispose()
      if (before !== undefined) await restore(before)
      return { ok: false, reason: "rejected", report }
    }

    const generation: AppGeneration = {
      appId,
      generation: nextGeneration++,
      descriptor: app,
      surface,
      dispose,
    }

    if (options.probe !== undefined) {
      try {
        await options.probe(generation)
      } catch (error) {
        await dispose()
        if (before !== undefined) await restore(before)
        return { ok: false, reason: "failed", report, error }
      }
    }

    // Commit. Retiring the old generation is safe *after* the new one is live:
    // every disposer it holds is identity- or generation-guarded, so it removes
    // only its own records, never the ones the new generation just wrote.
    if (before !== undefined) await before.dispose()
    gens.push(generation)
    await slotOptions.onChange?.(generation)
    return { ok: true, generation, report }
  }

  return {
    appId,
    current,
    previous,
    generations: () => [...gens],

    install,

    async rollback(options: InstallOptions = {}): Promise<InstallResult> {
      const target = previous()
      if (target === undefined) {
        return { ok: false, reason: "rejected", report: CLEAN, error: new Error(`no previous generation for "${appId}"`) }
      }
      // Rollback is install run backwards: the same adjudicator, the same probe,
      // the same restore-on-failure path (docs/script-sandbox.md §5.2).
      return install(target.descriptor, options)
    },

    async unload(): Promise<void> {
      const live = current()
      if (live === undefined) return
      gens.length = 0
      await live.dispose()
    },
  }
}
